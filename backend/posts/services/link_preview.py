"""Fetch Open Graph metadata for a URL so posts can show a link card.

The server fetches arbitrary user-supplied URLs here, so it guards against
SSRF: only http(s), every hop (including redirects) must resolve to public
IP addresses, the body is size-capped, and results are cached.
"""

import hashlib
import ipaddress
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests
from django.core.cache import cache

MAX_BYTES = 512 * 1024
TIMEOUT = 4
MAX_REDIRECTS = 3
CACHE_TTL = 60 * 60 * 24
IMAGE = object()  # sentinel: the URL itself is an image
UA = "Mozilla/5.0 (compatible; GlowLinkPreview/1.0)"


def _is_public_host(host):
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError):
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if not ip.is_global or ip.is_multicast:
            return False
    return bool(infos)


def _safe_url(url):
    p = urlparse(url)
    return p.scheme in ("http", "https") and p.hostname and _is_public_host(p.hostname)


class _MetaParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {}
        self.title = ""
        self.icon = None
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta":
            key = (a.get("property") or a.get("name") or "").lower()
            if key and "content" in a and key not in self.meta:
                self.meta[key] = a["content"].strip()
        elif tag == "title":
            self._in_title = True
        elif tag == "link" and not self.icon and "icon" in a.get("rel", "").lower():
            self.icon = a.get("href")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title and len(self.title) < 300:
            self.title += data


def _fetch_html(url):
    for _ in range(MAX_REDIRECTS + 1):
        if not _safe_url(url):
            return None, url
        r = requests.get(
            url, timeout=TIMEOUT, stream=True, allow_redirects=False,
            headers={"User-Agent": UA, "Accept": "text/html,image/*;q=0.8"},
        )
        if r.is_redirect:
            url = urljoin(url, r.headers.get("Location", ""))
            r.close()
            continue
        ctype = r.headers.get("Content-Type", "")
        if r.status_code == 200 and ctype.startswith("image/"):
            r.close()
            return IMAGE, url
        if r.status_code != 200 or "html" not in ctype:
            r.close()
            return None, url
        body = b""
        for chunk in r.iter_content(16384):
            body += chunk
            if len(body) >= MAX_BYTES:
                break
        r.close()
        return body.decode(r.encoding or "utf-8", errors="replace"), url
    return None, url


# Sites that don't serve metadata to servers but offer an official oEmbed API.
OEMBED = {
    "youtube.com": "https://www.youtube.com/oembed",
    "youtu.be": "https://www.youtube.com/oembed",
    "vimeo.com": "https://vimeo.com/api/oembed.json",
}


def _oembed(url):
    host = (urlparse(url).hostname or "").lower()
    host = host[4:] if host.startswith("www.") else host
    host = host[2:] if host.startswith("m.") else host
    endpoint = OEMBED.get(host)
    if not endpoint:
        return None
    r = requests.get(endpoint, params={"url": url, "format": "json"},
                     timeout=TIMEOUT, headers={"User-Agent": UA})
    if r.status_code != 200:
        return None
    j = r.json()
    if not j.get("title"):
        return None
    return {
        "url": url,
        "kind": "video",
        "title": j["title"][:200],
        "description": j.get("author_name") or "",
        "image": j.get("thumbnail_url"),
        "site_name": j.get("provider_name") or host,
        "favicon": f"https://{host}/favicon.ico",
    }


def get_link_preview(url):
    key = "linkpreview:" + hashlib.sha256(url.encode()).hexdigest()
    cached = cache.get(key)
    if cached is not None:
        return cached or None

    data = None
    try:
        data = _oembed(url)
        html, final_url = (None, url) if data else _fetch_html(url)
        if data:
            pass
        elif html is IMAGE:
            data = {"url": url, "kind": "image", "image": final_url,
                    "site_name": urlparse(final_url).hostname}
        elif html:
            p = _MetaParser()
            p.feed(html)
            m = p.meta
            title = m.get("og:title") or m.get("twitter:title") or p.title.strip()
            if title:
                image = m.get("og:image") or m.get("twitter:image")
                data = {
                    "url": url,
                    "title": title[:200],
                    "description": (m.get("og:description") or m.get("description") or "")[:300],
                    "image": urljoin(final_url, image) if image else None,
                    "site_name": m.get("og:site_name") or urlparse(final_url).hostname,
                    "favicon": urljoin(final_url, p.icon or "/favicon.ico"),
                }
    except (requests.RequestException, ValueError):
        data = None

    # Cache misses too (as {}) so a dead link isn't refetched on every view.
    cache.set(key, data or {}, CACHE_TTL if data else 60 * 30)
    return data

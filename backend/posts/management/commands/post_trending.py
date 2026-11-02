import re
import xml.etree.ElementTree as ET
from datetime import timedelta

import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from GlowProject.db import fetch_all
from posts.discover import bump_explore
from posts.queries import add_photo, add_tags, bot_account_id, insert_post
from posts.visibility import audience_id

FEED_URL = "https://trends.google.com/trending/rss?geo={geo}"
NS = {"ht": "https://trends.google.com/trending/rss"}

BOT_USERNAME = "glow_trends"
BOT_FIRST, BOT_LAST = "Glow", "Trends"
BOT_BIO = "Automated account. Posts what people are searching for today."

COUNTRY = {"PH": "the Philippines", "US": "the US", "GB": "the UK", "SG": "Singapore"}

BLOCKLIST = re.compile(  # trending searches can be crude or graphic: skip anything that matches
    r"\b(sex|sexy|porn|nude|naked|penis|vagina|whore|slut|rape|xxx|onlyfans|"
    r"kill(ed|ing)?|murder|dead|death|died|shooting|stab(bed)?|suicide|"
    r"scandal|leak(ed)?|nsfw|lotto|lottery|casino|bet(ting)?|sabong)\b",
    re.IGNORECASE,
)


def _text(el, path):
    found = el.find(path, NS)
    return (found.text or "").strip() if found is not None and found.text else ""


def fetch_trends(geo):
    resp = requests.get(
        FEED_URL.format(geo=geo),
        timeout=15,
        headers={"User-Agent": "GlowTrendsBot/1.0"},
    )
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    trends = []
    for item in root.iter("item"):
        news = [
            {
                "title": _text(n, "ht:news_item_title"),
                "url": _text(n, "ht:news_item_url"),
                "source": _text(n, "ht:news_item_source"),
                "picture": _text(n, "ht:news_item_picture"),
            }
            for n in item.findall("ht:news_item", NS)
        ]
        trends.append({
            "topic": _text(item, "title"),
            "traffic": _text(item, "ht:approx_traffic"),
            "picture": _text(item, "ht:picture"),
            "news": [n for n in news if n["url"] and "facebook.com" not in n["url"]] or news,  # real news sites first
        })
    return trends


def picture_for(trend):  # Google Trends supplies thumbnails, so we never scrape the news site
    n = trend["news"][0] if trend["news"] else {}
    pic = n.get("picture") or trend.get("picture") or ""
    return pic if pic.startswith("https://") else ""


def is_safe(trend):  # checks every headline and URL slug too: crude words often hide there
    parts = [trend["topic"]]
    for n in trend["news"]:
        parts += [n["title"], n["url"].replace("-", " ").replace("_", " ")]
    return bool(trend["topic"]) and not BLOCKLIST.search(" ".join(parts))


def make_caption(trend, geo):
    topic = trend["topic"].title() if trend["topic"].islower() else trend["topic"]
    where = COUNTRY.get(geo.upper(), geo.upper())
    lines = [f"Trending in {where}: {topic}"]
    if trend["traffic"]:
        lines.append(f"{trend['traffic']} searches today")
    if trend["news"]:
        n = trend["news"][0]
        lines += ["", f"{n['title']} ({n['source']})" if n["source"] else n["title"], n["url"]]
    lines += ["", "#trending"]
    return "\n".join(lines)[:800]


class Command(BaseCommand):
    help = (
        "Post today's trending topics (Google Trends RSS, no API key) as @glow_trends. "
        "Topics posted in the last 24 hours are skipped, so run it every few hours: 0 */3 * * *"
    )

    def add_arguments(self, parser):
        parser.add_argument("--geo", default="PH", help="Country code, e.g. PH, US (default PH)")
        parser.add_argument("--limit", type=int, default=5, help="Max new posts per run (default 5)")
        parser.add_argument("--dry-run", action="store_true", help="Print posts without saving")

    def handle(self, geo, limit, dry_run, **opts):
        try:
            trends = fetch_trends(geo)
        except (requests.RequestException, ET.ParseError) as e:
            self.stderr.write(f"Couldn't fetch trends: {e}")
            return

        bot_id = None if dry_run else bot_account_id(BOT_USERNAME, BOT_FIRST, BOT_LAST, BOT_BIO)
        recent = {}  # first caption line -> post, for topics posted in the last 24 hours
        if bot_id:
            for post in fetch_all(
                """
                SELECT p.id, p.caption,
                       EXISTS (SELECT 1 FROM glow.glow.posts_photo ph WHERE ph.post_id = p.id) AS has_photo
                FROM glow.glow.posts_post p
                WHERE p.account_id = %s AND p."dateTime" >= %s
                """,
                (bot_id, timezone.now() - timedelta(hours=24)),
            ):
                recent[post["caption"].split("\n", 1)[0].lower()] = post

        posted = skipped = 0
        for trend in trends:
            if posted >= limit:
                break
            if not is_safe(trend):
                skipped += 1
                continue
            caption = make_caption(trend, geo)
            picture = picture_for(trend)
            existing = recent.get(caption.split("\n", 1)[0].lower())
            if existing:
                if picture and not existing["has_photo"] and not dry_run:
                    add_photo(existing["id"], picture)  # already posted: just add the missing thumbnail
                continue
            if dry_run:
                self.stdout.write(caption + "\n" + "-" * 40)
                posted += 1
                continue
            with transaction.atomic():
                post_id = insert_post(bot_id, audience_id("public"), caption)
                if picture:
                    add_photo(post_id, picture)
                add_tags(post_id, ["trending"])
            posted += 1

        if posted and not dry_run:
            bump_explore()
        verb = "Would post" if dry_run else "Posted"
        self.stdout.write(self.style.SUCCESS(f"{verb} {posted} trend(s); skipped {skipped} unsafe."))

"""Post today's trending topics as the @glow_trends bot.

    python manage.py post_trending              # top 5 Philippine trends
    python manage.py post_trending --geo US --limit 3
    python manage.py post_trending --dry-run    # print, don't post

Source: Google Trends' public "Daily Search Trends" RSS (no API key).
Run it from cron every few hours; topics already posted in the last
24 hours are skipped, so repeated runs only add what's new.
"""

import re
import xml.etree.ElementTree as ET
from datetime import timedelta

import requests
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Account
from posts.models import Audience, Photo, Post, Tag

FEED_URL = "https://trends.google.com/trending/rss?geo={geo}"
NS = {"ht": "https://trends.google.com/trending/rss"}

BOT_USERNAME = "glow_trends"
BOT_FIRST, BOT_LAST = "Glow", "Trends"
BOT_BIO = "Automated account. Posts what people are searching for today."

COUNTRY = {"PH": "the Philippines", "US": "the US", "GB": "the UK", "SG": "Singapore"}

# Trending searches can be crude or graphic. Skip anything that matches.
BLOCKLIST = re.compile(
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
            # Prefer a real news site over social-media reposts.
            "news": [n for n in news if n["url"] and "facebook.com" not in n["url"]] or news,
        })
    return trends


def picture_for(trend):
    """Thumbnail for the post. Google Trends supplies these (hosted on
    gstatic.com), so we never have to scrape the news site itself."""
    n = trend["news"][0] if trend["news"] else {}
    pic = n.get("picture") or trend.get("picture") or ""
    return pic if pic.startswith("https://") else ""


def is_safe(trend):
    # Check the topic and every headline/link: crude words often hide in a
    # second article or in the URL slug ("...-little-whore-outfit-...").
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


def get_bot():
    User = get_user_model()
    user, created = User.objects.get_or_create(
        username=BOT_USERNAME, defaults={"email": "", "is_active": True}
    )
    if created:
        user.set_unusable_password()  # nobody can log in as the bot
        user.save(update_fields=["password"])
    account = Account.objects.filter(auth_user=user).first()
    if not account:
        account = Account.objects.create(
            auth_user=user, firstname=BOT_FIRST, lastname=BOT_LAST, bio=BOT_BIO, is_bot=True
        )
    elif not account.is_bot:
        account.is_bot = True
        account.save(update_fields=["is_bot"])
    return account


class Command(BaseCommand):
    help = "Post today's trending topics (Google Trends) as the @glow_trends bot."

    def add_arguments(self, parser):
        parser.add_argument("--geo", default="PH", help="Country code, e.g. PH, US (default PH)")
        parser.add_argument("--limit", type=int, default=5, help="Max new posts per run (default 5)")
        parser.add_argument("--dry-run", action="store_true", help="Print posts without saving")

    def handle(self, geo, limit, dry_run, **opts):
        try:
            trends = fetch_trends(geo)
        except Exception as e:
            self.stderr.write(f"Couldn't fetch trends: {e}")
            return

        bot = None if dry_run else get_bot()
        since = timezone.now() - timedelta(hours=24)
        recent = {}
        if bot:
            recent = {
                p.caption.split("\n", 1)[0].lower(): p
                for p in Post.objects.filter(account=bot, dateTime__gte=since)
            }

        public = Audience.objects.filter(key="public").first()
        tag, posted, skipped = None, 0, 0
        for trend in trends:
            if posted >= limit:
                break
            if not is_safe(trend):
                skipped += 1
                continue
            caption = make_caption(trend, geo)
            existing = recent.get(caption.split("\n", 1)[0].lower())
            if existing:
                # Already posted: just add the thumbnail if it's missing.
                pic = picture_for(trend)
                if pic and not Photo.objects.filter(post=existing).exists():
                    Photo.objects.create(post=existing, link=pic)
                continue
            if dry_run:
                self.stdout.write(caption + "\n" + "-" * 40)
                posted += 1
                continue
            with transaction.atomic():
                post = Post.objects.create(account=bot, audience=public, caption=caption)
                pic = picture_for(trend)
                if pic:
                    Photo.objects.create(post=post, link=pic)
                tag = tag or Tag.objects.get_or_create(tag="trending")[0]
                tag.post.add(post)
            posted += 1

        if posted and not dry_run:
            from posts.discover import bump_explore
            bump_explore()
        verb = "Would post" if dry_run else "Posted"
        self.stdout.write(self.style.SUCCESS(f"{verb} {posted} trend(s); skipped {skipped} unsafe."))

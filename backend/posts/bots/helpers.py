import re
from dataclasses import dataclass, field
from typing import Optional

import requests

MAX_CAPTION = 800

UNSAFE_WORDS = re.compile(  # a safety net on top of sources that are already family-friendly
    r"\b(sex|sexy|porn|nude|naked|penis|vagina|whore|slut|rape|xxx|nsfw|"
    r"suicide|murder|massacre|genocide|terror(ist|ism)?|bomb(ing)?|"
    r"execut(ed|ion)|lynch(ed|ing)?|holocaust|nazi)\b",
    re.IGNORECASE,
)


@dataclass
class BotPost:  # what a source returns: one post, ready to publish
    caption: str
    tags: list = field(default_factory=list)
    photo: str = ""  # https URL
    comment: str = ""  # the bot's own first comment
    poll_options: list = field(default_factory=list)  # 2-4 options make a poll
    poll_correct: Optional[int] = None  # index of the right answer, for quizzes
    poll_hours: int = 24


def make_post(*paragraphs, tags=(), **extra):  # caption = paragraphs separated by blank lines, then the hashtags
    hashtags = " ".join(f"#{tag}" for tag in tags)
    caption = "\n\n".join(p for p in [*paragraphs, hashtags] if p)
    return BotPost(caption=caption[:MAX_CAPTION], tags=list(tags), **extra)


def get_json(url):
    response = requests.get(url, headers={"User-Agent": "GlowBots/1.0 (+https://glow.social)"}, timeout=15)
    response.raise_for_status()
    return response.json()


def is_safe(*texts):
    return not UNSAFE_WORDS.search(" ".join(texts))


def shorten(text, limit):  # cut at a word boundary and add "…"
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"


def https_only(url):
    return url if (url or "").startswith("https://") else ""


def wikipedia_photo(page):  # the original if it's a sensible size, else Wikimedia's standard 960px copy
    original = page.get("originalimage") or {}
    source = original.get("source", "")
    if source and original.get("width", 0) <= 1600 and not source.endswith(".svg"):
        return source
    thumbnail = (page.get("thumbnail") or {}).get("source", "")
    if "/thumb/" in thumbnail:
        return re.sub(r"/\d+px-", "/960px-", thumbnail.split("?")[0])
    return thumbnail


def wikipedia_link(page):
    return (page.get("content_urls") or {}).get("desktop", {}).get("page", "")

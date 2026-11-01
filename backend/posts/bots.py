"""Glow's automated accounts. Each bot fetches one piece of content from a
free, keyless source and posts it publicly, marked `is_bot` (shown with an
"Automated" badge and ranked below real people in the feed).

Run them with `python manage.py post_bots` (see that command)."""

import html
import random
import re
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Callable, Optional

import requests
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from accounts.models import Account

from .models import Audience, Photo, Post, Tag

HEADERS = {"User-Agent": "GlowBots/1.0 (+https://glow.social)"}
TIMEOUT = 15

# Shared safety net for every bot (sources are already family-friendly).
BLOCKLIST = re.compile(
    r"\b(sex|sexy|porn|nude|naked|penis|vagina|whore|slut|rape|xxx|nsfw|"
    r"suicide|murder|massacre|genocide|terror(ist|ism)?|bomb(ing)?|"
    r"execut(ed|ion)|lynch(ed|ing)?|holocaust|nazi)\b",
    re.IGNORECASE,
)


@dataclass
class BotPost:
    caption: str
    photo: str = ""                          # https URL, optional
    comment: str = ""                        # bot's own first comment, optional
    tags: list = field(default_factory=list)
    poll_options: list = field(default_factory=list)   # 2-4 options -> a poll
    poll_correct: Optional[int] = None                 # index of the right answer (quiz)
    poll_hours: int = 24


@dataclass
class Bot:
    username: str
    first: str
    last: str
    bio: str
    fetch: Callable[[], Optional[BotPost]]
    dedupe_days: int = 30                    # don't repeat a caption within this window


def _get(url, **kw):
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, **kw)
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------- sources
def _wiki_photo(page):
    """A sharp image for a Wikipedia page: the original if it's a sensible
    size, otherwise Wikimedia's standard 960px rendition."""
    orig = page.get("originalimage") or {}
    if orig.get("source") and orig.get("width", 0) <= 1600 and not orig["source"].endswith(".svg"):
        return orig["source"]
    thumb = (page.get("thumbnail") or {}).get("source", "")
    if "/thumb/" in thumb:
        return re.sub(r"/\d+px-", "/960px-", thumb.split("?")[0])
    return thumb


def fetch_history() -> Optional[BotPost]:
    """Wikipedia's "On this day" selected events, with the article photo."""
    today = timezone.localdate()
    data = _get(
        f"https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/{today:%m}/{today:%d}"
    )
    events = [e for e in data.get("selected", []) if e.get("text") and e.get("pages")]
    random.shuffle(events)
    # Prefer events whose article has a decent-sized image.
    events.sort(key=lambda e: not any(p.get("originalimage") for p in e["pages"]))
    for e in events:
        if BLOCKLIST.search(e["text"]):
            continue
        page = next((p for p in e["pages"] if p.get("originalimage")), e["pages"][0])
        photo = _wiki_photo(page)
        url = (page.get("content_urls") or {}).get("desktop", {}).get("page", "")
        year = e.get("year")
        caption = f"On this day in {year}: {e['text']}"
        if url:
            caption += f"\n\nRead more: {url}"
        caption += "\n\n#onthisday #history"
        return BotPost(caption=caption[:800], photo=photo, tags=["onthisday", "history"])
    return None


def fetch_trivia() -> Optional[BotPost]:
    """One multiple-choice question; the answer goes in the first comment."""
    data = _get("https://opentdb.com/api.php?amount=5&type=multiple")
    for q in data.get("results", []):
        question = html.unescape(q["question"])
        answer = html.unescape(q["correct_answer"])
        if BLOCKLIST.search(question + " " + answer):
            continue
        options = [answer] + [html.unescape(a) for a in q["incorrect_answers"]]
        if any(len(o) > 80 for o in options):
            continue  # too long for a poll option
        random.shuffle(options)
        category = html.unescape(q["category"]).split(": ")[-1]
        return BotPost(
            caption=f"Trivia · {category}\n\n{question}\n\nVote to see if you got it right!"[:800],
            tags=["trivia"],
            poll_options=options,
            poll_correct=options.index(answer),
        )
    return None


def fetch_quote() -> Optional[BotPost]:
    data = _get("https://zenquotes.io/api/random")
    if not data:
        return None
    q, a = data[0].get("q", "").strip(), data[0].get("a", "").strip()
    if not q or BLOCKLIST.search(q) or "zenquotes" in q.lower():
        return None
    return BotPost(caption=f"“{q}”\n— {a}\n\n#quotes", tags=["quotes"])


def fetch_joke() -> Optional[BotPost]:
    data = _get(
        "https://v2.jokeapi.dev/joke/Pun,Programming,Misc"
        "?safe-mode&blacklistFlags=nsfw,religious,political,racist,sexist,explicit"
    )
    if data.get("error"):
        return None
    if data.get("type") == "twopart":
        text = f"{data['setup']}\n\n{data['delivery']}"
    else:
        text = data.get("joke", "")
    if not text or BLOCKLIST.search(text):
        return None
    return BotPost(caption=f"{text}\n\n#jokes", tags=["jokes"])


def _featured():
    today = timezone.localdate()
    return _get(
        f"https://api.wikimedia.org/feed/v1/wikipedia/en/featured/{today:%Y/%m/%d}"
    )


def fetch_photo_of_day() -> Optional[BotPost]:
    """Wikimedia Commons' Picture of the Day (freely licensed, credited)."""
    im = _featured().get("image") or {}
    photo = (im.get("thumbnail") or {}).get("source", "")
    desc = re.sub(r"\s+", " ", (im.get("description") or {}).get("text", "")).strip()
    if not photo or BLOCKLIST.search(desc):
        return None
    if len(desc) > 400:
        desc = desc[:400].rsplit(" ", 1)[0] + "…"
    artist = (im.get("artist") or {}).get("text", "").strip()
    lic = (im.get("license") or {}).get("type", "")
    credit = " · ".join(x for x in (f"Photo: {artist}" if artist else "", lic) if x)
    caption = f"Picture of the day\n\n{desc}"
    if credit:
        caption += f"\n\n{credit} (Wikimedia Commons)"
    caption += "\n\n#photography"
    return BotPost(caption=caption[:800], photo=photo, tags=["photography"])


def fetch_featured_article() -> Optional[BotPost]:
    """Wikipedia's Today's Featured Article: a short read with a photo."""
    t = _featured().get("tfa") or {}
    extract = (t.get("extract") or "").strip()
    title = t.get("normalizedtitle") or ""
    if not extract or BLOCKLIST.search(title + " " + extract):
        return None
    if len(extract) > 500:
        extract = extract[:500].rsplit(" ", 1)[0] + "…"
    url = (t.get("content_urls") or {}).get("desktop", {}).get("page", "")
    caption = f"Today I learned: {title}\n\n{extract}"
    if url:
        caption += f"\n\nRead more: {url}"
    caption += "\n\n#todayilearned"
    return BotPost(caption=caption[:800], photo=_wiki_photo(t), tags=["todayilearned"])


def fetch_dog() -> Optional[BotPost]:
    data = _get("https://dog.ceo/api/breeds/image/random")
    url = data.get("message", "")
    if not url.startswith("https://"):
        return None
    m = re.search(r"/breeds/([^/]+)/", url)
    breed = " ".join(reversed(m.group(1).split("-"))).title() if m else "good boy"
    return BotPost(caption=f"Meet today's dog: a {breed} 🐶\n\nRate this pup from 1 to 10 in the comments.\n\n#dogs",
                   photo=url, tags=["dogs", "pets"])


def fetch_cat() -> Optional[BotPost]:
    data = _get("https://api.thecatapi.com/v1/images/search")
    url = (data[0] if data else {}).get("url", "")
    if not url.startswith("https://"):
        return None
    lines = [
        "Your daily cat 🐱",
        "Cat of the day. Caption this 👇",
        "A cat to brighten your feed 🐱",
    ]
    return BotPost(caption=f"{random.choice(lines)}\n\n#cats", photo=url, tags=["cats", "pets"])


def fetch_space() -> Optional[BotPost]:
    """NASA's Astronomy Picture of the Day (set NASA_API_KEY for reliability)."""
    import os

    key = os.getenv("NASA_API_KEY", "DEMO_KEY")
    d = _get(f"https://api.nasa.gov/planetary/apod?api_key={key}&thumbs=true")
    if d.get("media_type") != "image":
        return None
    photo = d.get("url", "")
    expl = (d.get("explanation") or "").strip()
    if len(expl) > 450:
        expl = expl[:450].rsplit(" ", 1)[0] + "…"
    credit = (d.get("copyright") or "NASA").strip().replace("\n", " ")
    caption = f"{d.get('title', 'Astronomy Picture of the Day')}\n\n{expl}\n\nImage: {credit} · NASA APOD\n\n#space"
    return BotPost(caption=caption[:800], photo=photo if photo.startswith("https://") else "", tags=["space"])


# ---------------------------------------------------------------- Philippines
PH_CITIES = [("Manila", 14.5995, 120.9842), ("Cebu", 10.3157, 123.8854), ("Davao", 7.1907, 125.4553)]

# WMO weather codes -> (emoji, words)
def _wx(code):
    if code == 0:
        return "☀️", "Sunny"
    if code in (1, 2):
        return "🌤️", "Partly cloudy"
    if code == 3:
        return "☁️", "Cloudy"
    if code in (45, 48):
        return "🌫️", "Foggy"
    if 51 <= code <= 67 or 80 <= code <= 82:
        return "🌧️", "Rain"
    if code >= 95:
        return "⛈️", "Thunderstorms"
    return "🌥️", "Mixed"


def fetch_ph_weather() -> Optional[BotPost]:
    lat = ",".join(str(c[1]) for c in PH_CITIES)
    lon = ",".join(str(c[2]) for c in PH_CITIES)
    data = _get(
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}&timezone=Asia%2FManila&forecast_days=1"
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    )
    data = data if isinstance(data, list) else [data]
    lines, rainy = [], False
    for (city, _, _), d in zip(PH_CITIES, data):
        day = d.get("daily") or {}
        try:
            code = day["weather_code"][0]
            lo, hi = round(day["temperature_2m_min"][0]), round(day["temperature_2m_max"][0])
            rain = day.get("precipitation_probability_max", [0])[0] or 0
        except (KeyError, IndexError, TypeError):
            continue
        emoji, words = _wx(code)
        rainy = rainy or rain >= 60
        lines.append(f"{emoji} {city}: {words}, {lo}–{hi}°C · {rain}% chance of rain")
    if not lines:
        return None
    today = timezone.localdate()
    caption = f"Weather today, {today:%A %b} {today.day} 🇵🇭\n\n" + "\n".join(lines)
    if rainy:
        caption += "\n\nBring a payong today ☔"
    caption += "\n\nForecast by Open-Meteo. For official warnings, follow PAGASA.\n\n#weather"
    return BotPost(caption=caption[:800], tags=["weather"])


# Holidays that call for a respectful tone, not "Happy ...!"
SOLEMN = re.compile(r"All Saints|All Souls|Good Friday|Maundy Thursday|Black Saturday|Holy Saturday", re.I)


def fetch_ph_holiday() -> Optional[BotPost]:
    """Today's (or an upcoming) Philippine public holiday, if any."""
    today = timezone.localdate()
    holidays = _get(f"https://date.nager.at/api/v3/PublicHolidays/{today.year}/PH")
    for h in holidays:
        try:
            d = timezone.datetime.fromisoformat(h["date"]).date()
        except (KeyError, ValueError):
            continue
        name, local = h.get("name", ""), h.get("localName", "")
        label = f"{name} ({local})" if local and local != name else name
        if d == today:
            if SOLEMN.search(name):
                caption = (f"Today is {label} 🕯️\n\nA day to remember and pray for loved ones. "
                           f"Take care, and travel safe if you're heading home.\n\n#holiday")
            else:
                caption = (f"Happy {name}! 🇵🇭\n\nToday is {label}, a public holiday in the Philippines. "
                           f"How are you spending it?\n\n#holiday")
            return BotPost(caption=caption, tags=["holiday"])
        days = (d - today).days
        if days == 3:
            return BotPost(
                caption=f"Long weekend check 🗓️\n\n{label} is in 3 days ({d:%A, %B} {d.day}). "
                        f"Any plans?\n\n#holiday",
                tags=["holiday"],
            )
    return None


# Kept short and checkable; add more freely.
PH_FACTS = [
    "The Philippines is made up of 7,641 islands, based on a 2016 count by NAMRIA.",
    "Filipino and English are the official languages, but more than 170 languages are spoken across the country.",
    "The Philippine eagle is the national bird and one of the largest eagles in the world.",
    "The Philippine tarsier, found in Bohol, is one of the smallest primates in the world.",
    "José Rizal wrote his famous novels, Noli Me Tángere and El Filibusterismo, in Spanish.",
    "The Rice Terraces of the Philippine Cordilleras are a UNESCO World Heritage Site.",
    "Tubbataha Reefs Natural Park in the Sulu Sea is a UNESCO World Heritage Site.",
    "The Puerto Princesa Underground River in Palawan was named one of the New 7 Wonders of Nature.",
    "Mayon Volcano in Albay is famous for its almost perfectly symmetrical cone.",
    "The Philippines declared independence from Spain on June 12, 1898, in Kawit, Cavite.",
    "The first jeepneys were made from US military jeeps left behind after World War II.",
    "Taal Volcano sits on an island in the middle of Taal Lake in Batangas.",
    "The yo-yo became a craze in the US in the 1920s thanks to Pedro Flores, a Filipino immigrant.",
    "The PBA, founded in 1975, is the oldest professional basketball league in Asia.",
    "Mount Apo in Mindanao is the highest mountain in the Philippines.",
    "The narra is the national tree of the Philippines.",
    "The sampaguita is the national flower of the Philippines.",
    "Vigan in Ilocos Sur is a UNESCO World Heritage City known for its Spanish colonial streets.",
]


def fetch_ph_fact() -> Optional[BotPost]:
    fact = PH_FACTS[timezone.localdate().toordinal() % len(PH_FACTS)]
    return BotPost(caption=f"Did you know? 🇵🇭\n\n{fact}\n\n#pinoytrivia", tags=["pinoytrivia"])


PH_BIO = "Automated account. Weather, holidays and fun facts from around the Philippines."

BOTS = {
    "history": Bot("glow_history", "Glow", "History",
                   "Automated account. What happened on this day, from Wikipedia.",
                   fetch_history, dedupe_days=365),
    "trivia": Bot("glow_trivia", "Glow", "Trivia",
                  "Automated account. A quiz a day: vote, then see the answer. Questions from Open Trivia DB.",
                  fetch_trivia, dedupe_days=90),
    "quotes": Bot("glow_quotes", "Glow", "Quotes",
                  "Automated account. A little inspiration. Quotes from zenquotes.io.",
                  fetch_quote, dedupe_days=180),
    "jokes": Bot("glow_jokes", "Glow", "Jokes",
                 "Automated account. Clean jokes and puns, from JokeAPI.",
                 fetch_joke, dedupe_days=180),
    "photos": Bot("glow_photos", "Glow", "Photos",
                  "Automated account. Wikimedia Commons' Picture of the Day, with credit.",
                  fetch_photo_of_day, dedupe_days=365),
    "learn": Bot("glow_learn", "Glow", "Learn",
                 "Automated account. One interesting Wikipedia article a day.",
                 fetch_featured_article, dedupe_days=365),
    "dogs": Bot("glow_dogs", "Glow", "Dogs",
                "Automated account. A dog a day. Photos from the Dog CEO API.",
                fetch_dog, dedupe_days=365),
    "cats": Bot("glow_cats", "Glow", "Cats",
                "Automated account. A cat a day. Photos from TheCatAPI.",
                fetch_cat, dedupe_days=365),
    "ph_weather": Bot("glow_pilipinas", "Glow", "Pilipinas", PH_BIO, fetch_ph_weather, dedupe_days=1),
    "ph_holiday": Bot("glow_pilipinas", "Glow", "Pilipinas", PH_BIO, fetch_ph_holiday, dedupe_days=7),
    "ph_fact": Bot("glow_pilipinas", "Glow", "Pilipinas", PH_BIO, fetch_ph_fact, dedupe_days=60),
    "space": Bot("glow_space", "Glow", "Space",
                 "Automated account. NASA's Astronomy Picture of the Day.",
                 fetch_space, dedupe_days=365),
}


# ---------------------------------------------------------------- posting
def get_bot_account(username, first, last, bio):
    """Create (or fetch) a bot's account. Bots can't log in."""
    User = get_user_model()
    user, created = User.objects.get_or_create(
        username=username, defaults={"email": "", "is_active": True}
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    account = Account.objects.filter(auth_user=user).first()
    if not account:
        account = Account.objects.create(
            auth_user=user, firstname=first, lastname=last, bio=bio, is_bot=True
        )
    elif not account.is_bot:
        account.is_bot = True
        account.save(update_fields=["is_bot"])
    return account


def publish(account, item: BotPost):
    """Save a bot post (plus optional photo, tags and first comment)."""
    from interactions.models import Comment

    public = Audience.objects.filter(key="public").first()
    with transaction.atomic():
        post = Post.objects.create(account=account, audience=public, caption=item.caption)
        if item.photo.startswith("https://"):
            Photo.objects.create(post=post, link=item.photo)
        for name in item.tags:
            Tag.objects.get_or_create(tag=name)[0].post.add(post)
        if item.comment:
            Comment.objects.create(post=post, account=account, content=item.comment)
        if item.poll_options:
            from .polls import create_poll
            create_poll(post.id, item.poll_options, item.poll_hours, item.poll_correct)
    from .discover import bump_explore
    bump_explore()
    return post


def run_bot(key, dry_run=False, attempts=3):
    """Fetch and post one item for bot `key`. Returns the caption or None."""
    bot = BOTS[key]
    account = None if dry_run else get_bot_account(bot.username, bot.first, bot.last, bot.bio)
    since = timezone.now() - timedelta(days=bot.dedupe_days)
    for _ in range(attempts):
        item = bot.fetch()
        if not item:
            continue
        if account:
            recent = Post.objects.filter(account=account, dateTime__gte=since)
            dup = (
                Photo.objects.filter(post__in=recent, link=item.photo).exists()
                if item.photo
                else recent.filter(caption=item.caption).exists()
            )
            if dup:
                continue  # already posted this one
        if not dry_run:
            publish(account, item)
        return item
    return None

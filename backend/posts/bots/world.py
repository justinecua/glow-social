import html
import os
import random

from django.utils import timezone

from .helpers import get_json, https_only, is_safe, make_post, shorten, wikipedia_link, wikipedia_photo


def history():  # Wikipedia's "On this day": a historical event with its article photo
    today = timezone.localdate()
    data = get_json(f"https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/{today:%m}/{today:%d}")
    events = [e for e in data.get("selected", []) if e.get("text") and e.get("pages") and is_safe(e["text"])]
    random.shuffle(events)
    events.sort(key=lambda e: not any(p.get("originalimage") for p in e["pages"]))  # events with a photo first
    if not events:
        return None

    event = events[0]
    page = next((p for p in event["pages"] if p.get("originalimage")), event["pages"][0])
    link = wikipedia_link(page)
    return make_post(
        f"On this day in {event.get('year')}: {event['text']}",
        f"Read more: {link}" if link else "",
        tags=["onthisday", "history"],
        photo=wikipedia_photo(page),
    )


def trivia():  # a multiple-choice quiz as a poll; voters see the right answer afterwards
    questions = get_json("https://opentdb.com/api.php?amount=5&type=multiple").get("results", [])
    for question in questions:
        text = html.unescape(question["question"])
        answer = html.unescape(question["correct_answer"])
        options = [answer] + [html.unescape(a) for a in question["incorrect_answers"]]
        if not is_safe(text, answer) or any(len(o) > 80 for o in options):  # poll options max out at 80 characters
            continue
        random.shuffle(options)
        category = html.unescape(question["category"]).split(": ")[-1]
        return make_post(
            f"Trivia · {category}",
            text,
            "Vote to see if you got it right!",
            tags=["trivia"],
            poll_options=options,
            poll_correct=options.index(answer),
        )
    return None


def quote():
    data = get_json("https://zenquotes.io/api/random")
    text = (data[0].get("q") or "").strip() if data else ""
    author = (data[0].get("a") or "").strip() if data else ""
    if not text or not is_safe(text) or "zenquotes" in text.lower():  # their rate-limit message comes back as a "quote"
        return None
    return make_post(f"“{text}”\n— {author}", tags=["quotes"])


def joke():
    data = get_json(
        "https://v2.jokeapi.dev/joke/Pun,Programming,Misc"
        "?safe-mode&blacklistFlags=nsfw,religious,political,racist,sexist,explicit"
    )
    if data.get("error"):
        return None
    text = f"{data['setup']}\n\n{data['delivery']}" if data.get("type") == "twopart" else data.get("joke", "")
    if not text or not is_safe(text):
        return None
    return make_post(text, tags=["jokes"])


def wikipedia_featured():
    today = timezone.localdate()
    return get_json(f"https://api.wikimedia.org/feed/v1/wikipedia/en/featured/{today:%Y/%m/%d}")


def photo_of_the_day():  # Wikimedia Commons' Picture of the Day, freely licensed and credited
    image = wikipedia_featured().get("image") or {}
    photo = (image.get("thumbnail") or {}).get("source", "")
    description = shorten((image.get("description") or {}).get("text", ""), 400)
    if not photo or not is_safe(description):
        return None

    artist = (image.get("artist") or {}).get("text", "").strip()
    license_name = (image.get("license") or {}).get("type", "")
    credit = " · ".join(part for part in [f"Photo: {artist}" if artist else "", license_name] if part)
    return make_post(
        "Picture of the day",
        description,
        f"{credit} (Wikimedia Commons)" if credit else "",
        tags=["photography"],
        photo=photo,
    )


def featured_article():  # Wikipedia's Today's Featured Article: a short read with a photo
    article = wikipedia_featured().get("tfa") or {}
    title = article.get("normalizedtitle") or ""
    summary = shorten(article.get("extract"), 500)
    if not summary or not is_safe(title, summary):
        return None
    link = wikipedia_link(article)
    return make_post(
        f"Today I learned: {title}",
        summary,
        f"Read more: {link}" if link else "",
        tags=["todayilearned"],
        photo=wikipedia_photo(article),
    )


def space():  # NASA's Astronomy Picture of the Day (set NASA_API_KEY; the demo key is rate-limited)
    data = get_json(f"https://api.nasa.gov/planetary/apod?api_key={os.getenv('NASA_API_KEY', 'DEMO_KEY')}&thumbs=true")
    if data.get("media_type") != "image":  # some days it's a video
        return None
    credit = (data.get("copyright") or "NASA").strip().replace("\n", " ")
    return make_post(
        data.get("title", "Astronomy Picture of the Day"),
        shorten(data.get("explanation"), 450),
        f"Image: {credit} · NASA APOD",
        tags=["space"],
        photo=https_only(data.get("url")),
    )

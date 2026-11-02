import json
import re
from datetime import date
from urllib.parse import urlparse

from django.utils import timezone

from friends.queries import are_friends
from GlowProject.db import execute, fetch_column, fetch_one, fetch_value
from kudos.services import chain_lengths
from posts.discover import find_posts

THEMES = {"default", "sunrise", "ocean", "paper", "neon"}
COLOR_KEYS = ("page", "card", "inner", "heading", "text")  # parts of the profile people can recolour
ACCENTS = {"theme", "blue", "violet", "rose", "orange", "green", "teal", "gold", "custom"}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
CARD_STYLES = {"flat", "shadow", "outline", "glass"}
BACKGROUNDS = {"plain", "dots", "court", "grid", "cover_blur"}
CORNERS = {"sharp", "rounded", "round"}
NAME_EFFECTS = {"none", "gradient", "swash", "gold"}
NAME_BADGES = {"", "🏓", "📸", "🎨", "🎵", "⚽", "📚", "✈️", "💻", "🎮", "☕"}
HEADER_LAYOUTS = {"classic", "centered", "split", "no_cover"}
COVER_PRESETS = {"photo", "aurora", "dusk", "court", "waves", "sunrise"}
COVER_ANIMATIONS = {"none", "drift", "pan"}
COVER_HEIGHTS = {"compact", "normal", "tall"}
AVATAR_FRAMES = {"none", "accent", "glow", "double", "sparks", "rising", "anniversary", "holiday"}
AVATAR_SHAPES = {"circle", "rounded"}
STATS = {"glows", "kudos", "friends", "games", "chain"}
TABS = ["posts", "photos", "thoughts", "glows", "about"]

ABOUT_KINDS = {"currently", "ask_me", "paddle", "home_court", "favorite"}
LINK_KINDS = {"instagram", "tiktok", "x", "youtube", "facebook", "website"}
PLAY_STYLES = {"", "banger", "dinker", "all_court"}
LEVELS = {"", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"}
BLOCK_TYPES = {
    "pinned_post", "featured_photos", "about_cards", "pickleball",
    "kudos_preview", "links", "song", "spotlight", "visitor_kudos",
}
MAX_BLOCKS = len(BLOCK_TYPES)

DEFAULT_DESIGN = {
    "theme": "default",
    "accent": "theme",
    "accent_custom": "#2442de",
    "colors": {key: "" for key in COLOR_KEYS},  # "" = use the theme's colour
    "card_style": "flat",
    "background": "plain",
    "corners": "rounded",
    "name_effect": "none",
    "name_badge": "",
    "header_layout": "classic",
    "cover_preset": "photo",
    "cover_animation": "none",
    "cover_height": "normal",
    "avatar_frame": "none",
    "avatar_shape": "circle",
    "stats": ["glows", "kudos", "friends"],
    "tabs": list(TABS),
    "mood": {"emoji": "", "text": ""},
    "blocks": [],
}

UNLOCKS = {  # (setting, value): what has to happen first
    ("avatar_frame", "rising"): "Receive 10 kudos",
    ("name_effect", "gold"): "Glow posts on 30 different days",
    ("avatar_frame", "anniversary"): "Be on Glow for a year",
    ("avatar_frame", "holiday"): "Available in December",
}


class DesignError(ValueError):
    pass


def unlock_progress(account_id):  # {"avatar_frame:rising": {"unlocked", "progress", "goal", "label"}, ...}
    kudos = fetch_value(
        "SELECT COUNT(*) FROM glow.glow.kudos_glownote WHERE recipient_id = %s AND NOT is_hidden",
        (account_id,), default=0,
    )
    glow_days = fetch_value(
        'SELECT COUNT(DISTINCT timestamp::date) FROM glow.glow.interactions_glow WHERE account_id = %s',
        (account_id,), default=0,
    )
    joined = fetch_value(
        """
        SELECT u.date_joined FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.id = %s
        """,
        (account_id,),
    )
    days_on_glow = (timezone.now() - joined).days if joined else 0
    today = date.today()
    holiday = today.month == 12

    progress = {
        ("avatar_frame", "rising"): (kudos, 10),
        ("name_effect", "gold"): (glow_days, 30),
        ("avatar_frame", "anniversary"): (days_on_glow, 365),
        ("avatar_frame", "holiday"): (1 if holiday else 0, 1),
    }
    return {
        f"{setting}:{value}": {
            "unlocked": done >= goal,
            "progress": min(done, goal),
            "goal": goal,
            "label": UNLOCKS[(setting, value)],
        }
        for (setting, value), (done, goal) in progress.items()
    }


def pick(data, key, allowed):
    value = data.get(key, DEFAULT_DESIGN[key])
    if value not in allowed:
        raise DesignError(f"Unknown {key.replace('_', ' ')}.")
    return value


def text(value, limit):
    return str(value or "").strip()[:limit]


def https_url(value, label):
    url = text(value, 500)
    if not url:
        return ""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise DesignError(f"The {label} link must start with https://")
    return url


def media_path(url):  # photos come back as full URLs but are stored as /media/... paths
    return urlparse(str(url or "")).path


def clean_list(data, key, allowed, limit):
    values = data.get(key, DEFAULT_DESIGN[key])
    if not isinstance(values, list):
        raise DesignError(f"{key.title()} must be a list.")
    cleaned = list(dict.fromkeys(v for v in values if v in allowed))  # known values only, no duplicates
    return cleaned[:limit]


def clean_block(block, account_id):
    kind = block.get("type") if isinstance(block, dict) else None
    if kind not in BLOCK_TYPES:
        raise DesignError("Unknown block.")

    if kind == "pinned_post":
        post_id = block.get("post_id")
        if not str(post_id).isdigit() or not fetch_value(
            "SELECT 1 FROM glow.glow.posts_post WHERE id = %s AND account_id = %s", (int(post_id), account_id)
        ):
            raise DesignError("Pick one of your own posts to pin.")
        return {"type": kind, "post_id": int(post_id)}

    if kind == "featured_photos":
        wanted = [media_path(p) for p in (block.get("photos") or [])][:6]
        own = set(fetch_column(
            """
            SELECT ph.link FROM glow.glow.posts_photo ph
            JOIN glow.glow.posts_post p ON p.id = ph.post_id
            WHERE p.account_id = %s AND ph.link = ANY(%s)
            """,
            (account_id, wanted),
        ))
        return {"type": kind, "photos": [p for p in wanted if p in own]}

    if kind == "about_cards":
        cards = [
            {"kind": c.get("kind"), "text": text(c.get("text"), 60)}
            for c in (block.get("cards") or [])[:4]
            if isinstance(c, dict) and c.get("kind") in ABOUT_KINDS and text(c.get("text"), 60)
        ]
        return {"type": kind, "cards": cards}

    if kind == "pickleball":
        level = str(block.get("level") or "")
        style = str(block.get("style") or "")
        if level not in LEVELS or style not in PLAY_STYLES:
            raise DesignError("Pick a level and play style from the list.")
        return {
            "type": kind,
            "level": level,
            "style": style,
            "home_court": text(block.get("home_court"), 80),
            "court_url": https_url(block.get("court_url"), "home court"),
        }

    if kind == "links":
        links = []
        for link in (block.get("links") or [])[:6]:
            if isinstance(link, dict) and link.get("kind") in LINK_KINDS and text(link.get("url"), 500):
                links.append({"kind": link["kind"], "url": https_url(link.get("url"), link["kind"])})
        return {"type": kind, "links": links}

    if kind == "song":
        title = text(block.get("title"), 60)
        if not title:
            raise DesignError("Give your profile song a title.")
        return {
            "type": kind,
            "title": title,
            "artist": text(block.get("artist"), 60),
            "url": https_url(block.get("url"), "song"),
        }

    if kind == "spotlight":
        friend_id = block.get("account_id")
        if not str(friend_id).isdigit() or not are_friends(account_id, int(friend_id)):
            raise DesignError("You can only spotlight one of your friends.")
        return {"type": kind, "account_id": int(friend_id), "note": text(block.get("note"), 80)}

    return {"type": kind}  # kudos_preview and visitor_kudos have no settings


def clean_design(data, account_id):  # only known options get saved; anything else is a 400
    if not isinstance(data, dict):
        raise DesignError("Design must be an object.")

    design = {
        "theme": pick(data, "theme", THEMES),
        "accent": pick(data, "accent", ACCENTS),
        "card_style": pick(data, "card_style", CARD_STYLES),
        "background": pick(data, "background", BACKGROUNDS),
        "corners": pick(data, "corners", CORNERS),
        "name_effect": pick(data, "name_effect", NAME_EFFECTS),
        "name_badge": pick(data, "name_badge", NAME_BADGES),
        "header_layout": pick(data, "header_layout", HEADER_LAYOUTS),
        "cover_preset": pick(data, "cover_preset", COVER_PRESETS),
        "cover_animation": pick(data, "cover_animation", COVER_ANIMATIONS),
        "cover_height": pick(data, "cover_height", COVER_HEIGHTS),
        "avatar_frame": pick(data, "avatar_frame", AVATAR_FRAMES),
        "avatar_shape": pick(data, "avatar_shape", AVATAR_SHAPES),
        "stats": clean_list(data, "stats", STATS, 3),
        "tabs": clean_list(data, "tabs", set(TABS), len(TABS)),
        "accent_custom": str(data.get("accent_custom") or DEFAULT_DESIGN["accent_custom"]),
    }
    if not HEX_COLOR.match(design["accent_custom"]):
        raise DesignError("Pick a colour like #ff6600.")

    colors = data.get("colors") if isinstance(data.get("colors"), dict) else {}
    design["colors"] = {key: str(colors.get(key) or "") for key in COLOR_KEYS}
    if any(value and not HEX_COLOR.match(value) for value in design["colors"].values()):
        raise DesignError("Pick colours like #ff6600.")
    if "posts" not in design["tabs"]:
        design["tabs"].insert(0, "posts")  # the Posts tab can be moved but not hidden

    mood = data.get("mood") if isinstance(data.get("mood"), dict) else {}
    design["mood"] = {"emoji": text(mood.get("emoji"), 8), "text": text(mood.get("text"), 40)}

    blocks = data.get("blocks") or []
    if not isinstance(blocks, list) or len(blocks) > MAX_BLOCKS:
        raise DesignError("Too many blocks.")
    cleaned_blocks, seen = [], set()
    for block in blocks:
        cleaned = clean_block(block, account_id)
        if cleaned["type"] in seen:
            raise DesignError("Each block can only be added once.")
        seen.add(cleaned["type"])
        cleaned_blocks.append(cleaned)
    design["blocks"] = cleaned_blocks

    unlocks = unlock_progress(account_id)
    for setting, value in UNLOCKS:
        if design[setting] == value and not unlocks[f"{setting}:{value}"]["unlocked"]:
            raise DesignError(f"That style is locked. {UNLOCKS[(setting, value)]} to unlock it.")
    return design


def as_dict(value):  # Django has psycopg2 return json columns as text, so raw SQL must decode them
    return json.loads(value) if isinstance(value, str) else value


def saved_design(account_id):
    row = fetch_one(
        "SELECT published, draft FROM glow.glow.accounts_profiledesign WHERE account_id = %s",
        (account_id,),
    )
    if row:
        row = {"published": as_dict(row["published"]), "draft": as_dict(row["draft"])}
    return row


def with_defaults(design):  # older saves may miss newer settings, or carry ones we've removed
    saved = {k: v for k, v in (design or {}).items() if k in DEFAULT_DESIGN}
    if saved.get("theme") not in THEMES:
        saved.pop("theme", None)  # a theme we've retired falls back to the default
    return {**DEFAULT_DESIGN, **saved}


def my_design(account_id):  # the editor: draft, what visitors see, and what's unlocked
    row = saved_design(account_id)
    published = with_defaults(row["published"] if row else None)
    draft = with_defaults(row["draft"] if row and row["draft"] else published)
    return {"draft": draft, "published": published, "unlocks": unlock_progress(account_id)}


def save_design(account_id, data, publish):
    design = clean_design(data, account_id)
    execute(
        """
        INSERT INTO glow.glow.accounts_profiledesign (account_id, published, draft, updated_at)
        VALUES (%(a)s, %(published)s::jsonb, %(draft)s::jsonb, %(now)s)
        ON CONFLICT (account_id) DO UPDATE SET
            draft = EXCLUDED.draft,
            published = CASE WHEN %(publish)s THEN EXCLUDED.draft ELSE accounts_profiledesign.published END,
            updated_at = EXCLUDED.updated_at
        """,
        {
            "a": account_id,
            "draft": json.dumps(design),
            "published": json.dumps(design if publish else DEFAULT_DESIGN),
            "publish": publish,
            "now": timezone.now(),
        },
    )
    return my_design(account_id)


def block_data(design, account_id, viewer_id, request):  # what the blocks need beyond their settings
    data = {}
    for block in design["blocks"]:
        if block["type"] == "pinned_post":
            posts = find_posts("WHERE p.id = %s", (block["post_id"],), limit=1, request=request, viewer_id=viewer_id)
            data["pinned_post"] = posts[0] if posts else None  # deleted or hidden from this viewer
        elif block["type"] == "featured_photos":
            data["featured_photos"] = [request.build_absolute_uri(p) for p in block["photos"]]
        elif block["type"] == "spotlight":
            friend = fetch_one(
                """
                SELECT a.id, u.username, a.firstname, a.lastname, a.profile_photo
                FROM glow.glow.accounts_account a
                JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
                WHERE a.id = %s
                """,
                (block["account_id"],),
                blank_nulls=True,
            )
            data["spotlight"] = friend if friend and are_friends(account_id, friend["id"]) else None
    return data


def profile_stats(account_id):  # numbers the stats bar can show that the page doesn't already load
    games = fetch_value(
        "SELECT COUNT(*) FROM glow.glow.games_playsessionplayer WHERE account_id = %s AND status = 'joined'",
        (account_id,), default=0,
    )
    note_ids = fetch_column(
        "SELECT id FROM glow.glow.kudos_glownote WHERE recipient_id = %s AND NOT is_hidden",
        (account_id,),
    )
    lengths = chain_lengths(note_ids).values()
    return {"games": games, "chain": max(lengths, default=0)}


def public_design(account_id, viewer_id, request):  # what anyone opening the profile sees
    row = saved_design(account_id)
    design = with_defaults(row["published"] if row else None)
    return {
        "design": design,
        "blocks": block_data(design, account_id, viewer_id, request),
        "stats": profile_stats(account_id),
    }


def preview_blocks(account_id, data, request):  # live preview of unsaved blocks in the editor
    design = with_defaults({"blocks": [clean_block(b, account_id) for b in (data.get("blocks") or [])][:MAX_BLOCKS]})
    return block_data(design, account_id, account_id, request)

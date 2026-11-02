import logging
from datetime import timedelta
from urllib.parse import urlparse

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from friends.queries import display_name
from GlowProject.db import execute, fetch_all, fetch_column, fetch_one, fetch_value
from notifications.queries import create_notification, push_notifications
from posts.visibility import can_view_post

log = logging.getLogger(__name__)

LEVELS = {"", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"}
MAX_CAPACITY = 64
MAX_COURTS = 20
GAME_OVER_AFTER = timedelta(hours=3)  # joining closes 3 hours after the start

PERSON_JSON = """json_build_object(
    'id', a.id,
    'username', COALESCE(u.username, ''),
    'firstname', COALESCE(a.firstname, ''),
    'lastname', COALESCE(a.lastname, ''),
    'profile_photo', COALESCE(a.profile_photo, '')
)"""

GAME_COLUMNS = f"""
    g.id, g.post_id, g.host_id, g.title, g.venue, g.starts_at, g.ends_at, g.level_min, g.level_max,
    g.capacity, g.courts, g.court_url, g.maps_url, g.court_booked, g.notes, g.created_at,
    {PERSON_JSON} AS host,
    (SELECT COUNT(*) FROM glow.glow.games_playsessionplayer p
     WHERE p.session_id = g.id AND p.status = 'joined') AS joined_count,
    (SELECT COUNT(*) FROM glow.glow.games_playsessionplayer p
     WHERE p.session_id = g.id AND p.status = 'waitlist') AS waitlist_count,
    (SELECT p.status FROM glow.glow.games_playsessionplayer p
     WHERE p.session_id = g.id AND p.account_id = %(me)s) AS my_status
"""

GAME_FROM = """
    FROM glow.glow.games_playsession g
    JOIN glow.glow.accounts_account a ON a.id = g.host_id
    LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
"""


class GameError(ValueError):
    pass


def iso(value):
    return value.isoformat() if value else None


def serialize(row, me):
    return {
        "id": row["id"],
        "post_id": row["post_id"],
        "title": row["title"],
        "venue": row["venue"],
        "starts_at": iso(row["starts_at"]),
        "ends_at": iso(row["ends_at"]),
        "level_min": row["level_min"],
        "level_max": row["level_max"],
        "capacity": row["capacity"],
        "courts": row["courts"],
        "court_url": row["court_url"],
        "maps_url": row["maps_url"],
        "court_booked": row["court_booked"],
        "notes": row["notes"],
        "host": row["host"],
        "is_host": row["host_id"] == me,
        "joined_count": row["joined_count"],
        "waitlist_count": row["waitlist_count"],
        "my_status": row["my_status"],  # "joined", "waitlist" or None
    }


def find_game(game_id):
    return fetch_one(
        "SELECT id, post_id, host_id, title, capacity FROM glow.glow.games_playsession WHERE id = %s",
        (game_id,),
    )


def find_visible_game(game_id, viewer_id):  # the game, if the viewer can see its post
    game = find_game(game_id)
    if not game or not can_view_post(game["post_id"], viewer_id):
        return None
    return game


def attach_games(posts, viewer_id=None):  # adds a "game" key (or None) to each post
    post_ids = [p["id"] for p in posts]
    rows = fetch_all(
        f"SELECT {GAME_COLUMNS} {GAME_FROM} WHERE g.post_id = ANY(%(posts)s)",
        {"posts": post_ids, "me": viewer_id},
    ) if post_ids else []
    games = {r["post_id"]: serialize(r, viewer_id) for r in rows}
    for post in posts:
        post["game"] = games.get(post["id"])
    return posts


def detail(game_id, me):  # the game plus everyone going and waiting
    row = fetch_one(f"SELECT {GAME_COLUMNS} {GAME_FROM} WHERE g.id = %(id)s", {"id": game_id, "me": me})
    if not row:
        return None
    players = fetch_all(
        f"""
        SELECT {PERSON_JSON} AS person, p.status, p.joined_at
        FROM glow.glow.games_playsessionplayer p
        JOIN glow.glow.accounts_account a ON a.id = p.account_id
        LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE p.session_id = %s
        ORDER BY p.joined_at, p.id
        """,
        (game_id,),
    )
    game = serialize(row, me)
    game["players"] = [{**p["person"], "status": p["status"]} for p in players]
    return game


def clean_url(value, label):  # https only: these open in a new tab from a button
    url = str(value or "").strip()
    if not url:
        return ""
    if len(url) > 500:
        raise GameError(f"The {label} link is too long.")
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise GameError(f"The {label} link must start with https://")
    return url


def clean_int(value, label, low, high):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise GameError(f"{label} must be a number.")
    if not low <= number <= high:
        raise GameError(f"{label} must be between {low} and {high}.")
    return number


def clean_time(value, label):
    when = parse_datetime(str(value or ""))
    if not when or timezone.is_naive(when):
        raise GameError(f"Pick a valid {label}.")
    return when


def clean_game(data, is_new):
    title = str(data.get("title") or "").strip()[:100]
    venue = str(data.get("venue") or "").strip()[:150]
    if not title:
        raise GameError("Give your game a name.")
    if not venue:
        raise GameError("Add where you're playing.")

    starts_at = clean_time(data.get("starts_at"), "start time")
    if is_new and starts_at < timezone.now():
        raise GameError("The start time has already passed.")
    ends_at = clean_time(data.get("ends_at"), "end time") if data.get("ends_at") else None
    if ends_at and ends_at <= starts_at:
        raise GameError("The game has to end after it starts.")

    level_min = str(data.get("level_min") or "")
    level_max = str(data.get("level_max") or "")
    if level_min not in LEVELS or level_max not in LEVELS:
        raise GameError("Pick a level from the list.")
    if level_min and level_max and float(level_min) > float(level_max):
        level_min, level_max = level_max, level_min

    return {
        "title": title,
        "venue": venue,
        "starts_at": starts_at,
        "ends_at": ends_at,
        "level_min": level_min,
        "level_max": level_max,
        "capacity": clean_int(data.get("capacity", 8), "Spots", 2, MAX_CAPACITY),
        "courts": clean_int(data.get("courts", 1), "Courts", 1, MAX_COURTS),
        "court_url": clean_url(data.get("court_url"), "court"),
        "maps_url": clean_url(data.get("maps_url"), "map"),
        "court_booked": str(data.get("court_booked")).lower() in ("true", "1"),
        "notes": str(data.get("notes") or "").strip()[:500],
    }


def player_ids(game_id):
    return fetch_column(
        "SELECT account_id FROM glow.glow.games_playsessionplayer WHERE session_id = %s",
        (game_id,),
    )


def push_update(game_id, account_ids):  # open game pages refetch the roster
    layer = get_channel_layer()
    for account_id in set(account_ids):
        try:
            async_to_sync(layer.group_send)(f"user_{account_id}", {"type": "games_updated", "game_id": game_id})
        except Exception:  # Redis down: the action itself still worked
            log.warning("Games realtime push failed", exc_info=True)
            return


def notify(type_name, to_id, from_id, content):
    create_notification(type_name, to_id, from_id, content)
    push_notifications(to_id, from_id)


def create_game(host_id, post_id, fields):  # `fields` from clean_game; call inside the post's transaction
    now = timezone.now()
    game_id = fetch_value(
        """
        INSERT INTO glow.glow.games_playsession
            (post_id, host_id, title, venue, starts_at, ends_at, level_min, level_max, capacity, courts,
             court_url, maps_url, court_booked, notes, created_at)
        VALUES (%(post)s, %(host)s, %(title)s, %(venue)s, %(starts_at)s, %(ends_at)s, %(level_min)s,
                %(level_max)s, %(capacity)s, %(courts)s, %(court_url)s, %(maps_url)s, %(court_booked)s,
                %(notes)s, %(now)s)
        RETURNING id
        """,
        {**fields, "post": post_id, "host": host_id, "now": now},
    )
    execute(  # the host plays too
        """
        INSERT INTO glow.glow.games_playsessionplayer (session_id, account_id, status, joined_at)
        VALUES (%s, %s, 'joined', %s)
        """,
        (game_id, host_id, now),
    )
    return game_id


def promote_waitlist(game_id, open_spots):  # earliest waitlisters fill open spots
    if open_spots <= 0:
        return []
    return fetch_column(
        """
        UPDATE glow.glow.games_playsessionplayer SET status = 'joined'
        WHERE id IN (
            SELECT id FROM glow.glow.games_playsessionplayer
            WHERE session_id = %s AND status = 'waitlist'
            ORDER BY joined_at, id
            LIMIT %s
        )
        RETURNING account_id
        """,
        (game_id, open_spots),
    )


def count_joined(game_id):
    return fetch_value(
        "SELECT COUNT(*) FROM glow.glow.games_playsessionplayer WHERE session_id = %s AND status = 'joined'",
        (game_id,),
    )


def lock(game_id):  # one join/leave/edit at a time per game, so spots never oversell
    return fetch_one(
        "SELECT id, host_id, title, capacity, starts_at FROM glow.glow.games_playsession WHERE id = %s FOR UPDATE",
        (game_id,),
    )


def tell_promoted(game, promoted):
    for account_id in promoted:
        notify("game_spot_opened", account_id, game["host_id"], f"A spot opened up. You're in for {game['title']}!")


def update(game, me, data):
    fields = clean_game(data, is_new=False)
    with transaction.atomic():
        lock(game["id"])
        joined = count_joined(game["id"])
        if fields["capacity"] < joined:
            raise GameError(f"{joined} players have already joined. Spots can't go below that.")
        execute(
            """
            UPDATE glow.glow.games_playsession SET
                title = %(title)s, venue = %(venue)s, starts_at = %(starts_at)s, ends_at = %(ends_at)s,
                level_min = %(level_min)s, level_max = %(level_max)s, capacity = %(capacity)s,
                courts = %(courts)s, court_url = %(court_url)s, maps_url = %(maps_url)s,
                court_booked = %(court_booked)s, notes = %(notes)s
            WHERE id = %(id)s
            """,
            {**fields, "id": game["id"]},
        )
        promoted = promote_waitlist(game["id"], fields["capacity"] - joined)
    tell_promoted({**game, "title": fields["title"]}, promoted)
    push_update(game["id"], player_ids(game["id"]))


def join(game_id, me):
    with transaction.atomic():
        game = lock(game_id)
        if not game:
            return None
        current = fetch_value(
            "SELECT status FROM glow.glow.games_playsessionplayer WHERE session_id = %s AND account_id = %s",
            (game_id, me),
        )
        if current:
            return current
        if game["starts_at"] < timezone.now() - GAME_OVER_AFTER:
            raise GameError("This game is already over.")
        status = "joined" if count_joined(game_id) < game["capacity"] else "waitlist"
        execute(
            """
            INSERT INTO glow.glow.games_playsessionplayer (session_id, account_id, status, joined_at)
            VALUES (%s, %s, %s, %s)
            """,
            (game_id, me, status, timezone.now()),
        )
    if game["host_id"] != me:
        verb = "joined" if status == "joined" else "is on the waitlist for"
        notify("game_joined", game["host_id"], me, f"{display_name(me)} {verb} {game['title']}")
    push_update(game_id, player_ids(game_id))
    return status


def leave(game_id, me):
    with transaction.atomic():
        game = lock(game_id)
        if not game:
            return None
        if game["host_id"] == me:
            raise GameError("You're hosting this game. Cancel it instead.")
        status = fetch_value(
            """
            DELETE FROM glow.glow.games_playsessionplayer
            WHERE session_id = %s AND account_id = %s
            RETURNING status
            """,
            (game_id, me),
        )
        promoted = promote_waitlist(game_id, game["capacity"] - count_joined(game_id)) if status == "joined" else []
    tell_promoted(game, promoted)
    if status:
        push_update(game_id, player_ids(game_id) + [me])
    return True


def game_on_post(post_id):  # read before the post is deleted, so the players can be told after
    game = fetch_one(
        "SELECT id, host_id, title FROM glow.glow.games_playsession WHERE post_id = %s",
        (post_id,),
    )
    if game:
        game["players"] = [p for p in player_ids(game["id"]) if p != game["host_id"]]
    return game


def tell_canceled(game):
    for account_id in game["players"]:
        notify("game_canceled", account_id, game["host_id"], f"{display_name(game['host_id'])} canceled {game['title']}")
    push_update(game["id"], game["players"])

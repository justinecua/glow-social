from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from GlowProject.db import fetch_all, fetch_column, fetch_one, fetch_tuples, fetch_value
from notifications.queries import create_notification
from posts.queries import time_ago

from .models import GlowNote

DAILY_LIMIT = 5  # kudos a person can send per 24h (anti-spam)
MAX_LENGTH = GlowNote.MAX_LENGTH
MAX_CHAIN_DEPTH = 50


class GlowError(Exception):
    pass


def person_json(account, user):  # one person as {"id", "username", "firstname", "lastname", "profile_photo"}
    return f"""json_build_object(
        'id', {account}.id,
        'username', COALESCE({user}.username, ''),
        'firstname', COALESCE({account}.firstname, ''),
        'lastname', COALESCE({account}.lastname, ''),
        'profile_photo', COALESCE({account}.profile_photo, '')
    )"""


NOT_PASSED_ON = """NOT EXISTS (
    SELECT 1 FROM glow.glow.kudos_glownote child WHERE child.passed_from_id = n.id
)"""


def chain_lengths(note_ids):  # {note_id: how many hops its chain has (at least 1)}
    if not note_ids:
        return {}
    return dict(fetch_tuples(
        """
        WITH RECURSIVE up AS (
            SELECT id AS root, passed_from_id, 1 AS depth
            FROM glow.glow.kudos_glownote WHERE id = ANY(%(ids)s)
            UNION ALL
            SELECT up.root, g.passed_from_id, up.depth + 1
            FROM up JOIN glow.glow.kudos_glownote g ON g.id = up.passed_from_id
            WHERE up.depth < %(max)s AND NOT g.is_hidden
        )
        SELECT root, MAX(depth) FROM up GROUP BY root
        """,
        {"ids": list(note_ids), "max": MAX_CHAIN_DEPTH},
    ))


def chain_for(note_id):  # everyone in the chain that led to this note, oldest first
    notes = fetch_all(
        f"""
        WITH RECURSIVE up AS (
            SELECT id, passed_from_id, 1 AS depth
            FROM glow.glow.kudos_glownote WHERE id = %(id)s AND NOT is_hidden
            UNION ALL
            SELECT g.id, g.passed_from_id, up.depth + 1
            FROM up JOIN glow.glow.kudos_glownote g ON g.id = up.passed_from_id
            WHERE up.depth < %(max)s AND NOT g.is_hidden
        )
        SELECT n.message, {person_json("s", "su")} AS sender, {person_json("r", "ru")} AS recipient
        FROM up
        JOIN glow.glow.kudos_glownote n ON n.id = up.id
        JOIN glow.glow.accounts_account s ON s.id = n.sender_id
        LEFT JOIN glow.glow.auth_user su ON su.id = s.auth_user_id
        JOIN glow.glow.accounts_account r ON r.id = n.recipient_id
        LEFT JOIN glow.glow.auth_user ru ON ru.id = r.auth_user_id
        ORDER BY up.depth DESC
        """,
        {"id": note_id, "max": MAX_CHAIN_DEPTH},
    )
    if not notes:
        return None
    return {
        "people": [notes[0]["sender"]] + [n["recipient"] for n in notes],  # origin sender, then each recipient
        "messages": [{"from": n["sender"]["username"], "message": n["message"]} for n in notes],
        "length": len(notes),
    }


def status_for(account_id):
    since = timezone.now() - timedelta(hours=24)
    sent_to = fetch_column(
        "SELECT recipient_id FROM glow.glow.kudos_glownote WHERE sender_id = %s AND created_at >= %s",
        (account_id, since),
    )
    passes = fetch_value(
        f"""
        SELECT COUNT(*) FROM glow.glow.kudos_glownote n
        WHERE n.recipient_id = %s AND NOT n.is_hidden AND {NOT_PASSED_ON}
        """,
        (account_id,),
    )
    return {
        "daily_limit": DAILY_LIMIT,
        "sent_today": len(sent_to),
        "remaining_today": max(0, DAILY_LIMIT - len(sent_to)),
        "passes_available": passes,
        "sent_to_today": sorted(set(sent_to)),  # the app disables "Send kudos" for these people
    }


def display_name(person):
    return f"{person['firstname']} {person['lastname']}".strip() or person["username"]


def find_person(account_id):
    row = fetch_one(
        f"""
        SELECT {person_json("a", "u")} AS person
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.id = %s AND u.is_active
        """,
        (account_id,),
    )
    return row["person"] if row else None


def check_can_send(sender_id, recipient_id, message):  # returns (recipient, clean message) or raises GlowError
    message = (message or "").strip()
    if not message:
        raise GlowError("Write a short note to go with your kudos.")
    if len(message) > MAX_LENGTH:
        raise GlowError(f"Keep it under {MAX_LENGTH} characters.")
    if not str(recipient_id).isdigit():
        raise GlowError("Choose who to send your kudos to.")
    if int(recipient_id) == sender_id:
        raise GlowError("You can't send kudos to yourself.")

    recipient = find_person(int(recipient_id))
    if not recipient:
        raise GlowError("That person wasn't found.")

    status = status_for(sender_id)
    if status["remaining_today"] == 0:
        raise GlowError(f"You've sent kudos {DAILY_LIMIT} times today. Come back tomorrow")
    if recipient["id"] in status["sent_to_today"]:
        raise GlowError("You already sent this person kudos today.")
    return recipient, message


def send_glow(sender_id, recipient_id, message):
    recipient, message = check_can_send(sender_id, recipient_id, message)
    sender = find_person(sender_id)

    with transaction.atomic():
        passed_from = fetch_value(  # pay it forward: use the oldest kudos you got but haven't passed on
            f"""
            SELECT n.id FROM glow.glow.kudos_glownote n
            WHERE n.recipient_id = %s AND NOT n.is_hidden AND {NOT_PASSED_ON}
            ORDER BY n.created_at
            LIMIT 1
            FOR UPDATE
            """,
            (sender_id,),
        )
        note = fetch_one(
            """
            INSERT INTO glow.glow.kudos_glownote (sender_id, recipient_id, message, passed_from_id, created_at, is_hidden)
            VALUES (%s, %s, %s, %s, %s, FALSE)
            RETURNING id, message, created_at, recipient_id
            """,
            (sender_id, recipient["id"], message, passed_from, timezone.now()),
        )
        create_notification(
            "glow_note", recipient["id"], sender_id, f"{display_name(sender)} sent you kudos “{message}”"
        )

    return shape_note(note, sender, chain_lengths([note["id"]]).get(note["id"], 1))


def shape_note(note, sender, chain_length=1):
    return {
        "id": note["id"],
        "message": note["message"],
        "created_at": time_ago(note["created_at"]),
        "sender": sender,
        "recipient_id": note["recipient_id"],
        "chain_length": chain_length,
    }


def wall(account_id, limit=60):  # kudos this person received, newest first
    notes = fetch_all(
        f"""
        SELECT n.id, n.message, n.created_at, n.recipient_id, {person_json("s", "u")} AS sender
        FROM glow.glow.kudos_glownote n
        JOIN glow.glow.accounts_account s ON s.id = n.sender_id
        JOIN glow.glow.auth_user u ON u.id = s.auth_user_id
        WHERE n.recipient_id = %s AND NOT n.is_hidden AND u.is_active
        ORDER BY n.created_at DESC
        LIMIT %s
        """,
        (account_id, limit),
    )
    lengths = chain_lengths([n["id"] for n in notes])
    total = fetch_value(
        "SELECT COUNT(*) FROM glow.glow.kudos_glownote WHERE recipient_id = %s AND NOT is_hidden",
        (account_id,),
    )
    return {
        "count": total,
        "notes": [shape_note(n, n["sender"], lengths.get(n["id"], 1)) for n in notes],
    }


def weekly():  # most-thanked people and the longest chain from the last 7 days
    since = timezone.now() - timedelta(days=7)
    most_glowed = fetch_all(
        f"""
        SELECT {person_json("a", "u")} AS person, COUNT(*) AS glows
        FROM glow.glow.kudos_glownote n
        JOIN glow.glow.accounts_account a ON a.id = n.recipient_id
        LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE n.created_at >= %s AND NOT n.is_hidden
        GROUP BY a.id, u.username
        ORDER BY glows DESC, a.id
        LIMIT 5
        """,
        (since,),
    )

    recent_ids = fetch_column(
        "SELECT id FROM glow.glow.kudos_glownote WHERE created_at >= %s AND NOT is_hidden LIMIT 2000",
        (since,),
    )
    longest = None
    lengths = chain_lengths(recent_ids)
    if lengths:
        best_id, best_length = max(lengths.items(), key=lambda item: (item[1], item[0]))
        if best_length >= 2:
            longest = chain_for(best_id)

    return {
        "most_glowed": [{**row["person"], "glows": row["glows"]} for row in most_glowed],
        "longest_chain": longest,
    }

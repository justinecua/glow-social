"""Pass the Glow: send appreciation notes, build chains, weekly highlights."""

from datetime import timedelta

from django.db import connection, transaction
from django.db.models import Count
from django.utils import timezone

from accounts.models import Account
from notifications.models import Notification, NotificationType
from posts.queries import time_ago

from .models import GlowNote

DAILY_LIMIT = 5          # glows a person can send per 24h (anti-spam)
MAX_CHAIN_DEPTH = 50


class GlowError(Exception):
    pass


def _person(account):
    user = account.auth_user
    return {
        "id": account.id,
        "username": getattr(user, "username", ""),
        "firstname": account.firstname or "",
        "lastname": account.lastname or "",
        "profile_photo": account.profile_photo or "",
    }


def _display_name(account):
    name = f"{account.firstname} {account.lastname}".strip()
    return name or getattr(account.auth_user, "username", "Someone")


def chain_lengths(note_ids):
    """{note_id: number of people-to-people hops in its chain (>= 1)}."""
    if not note_ids:
        return {}
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            WITH RECURSIVE up AS (
                SELECT id AS root, passed_from_id, 1 AS depth
                FROM kudos_glownote WHERE id = ANY(%s)
                UNION ALL
                SELECT up.root, g.passed_from_id, up.depth + 1
                FROM up JOIN kudos_glownote g ON g.id = up.passed_from_id
                WHERE up.depth < {MAX_CHAIN_DEPTH} AND NOT g.is_hidden
            )
            SELECT root, MAX(depth) FROM up GROUP BY root
            """,
            [list(note_ids)],
        )
        return dict(cursor.fetchall())


def chain_for(note_id):
    """People in the chain that led to this note, oldest first:
    [origin sender, ..., this note's sender, this note's recipient]."""
    notes = []
    current = (
        GlowNote.objects.select_related("sender__auth_user", "recipient__auth_user")
        .filter(id=note_id, is_hidden=False)
        .first()
    )
    while current and len(notes) < MAX_CHAIN_DEPTH:
        notes.append(current)
        parent_id = current.passed_from_id
        current = (
            GlowNote.objects.select_related("sender__auth_user", "recipient__auth_user")
            .filter(id=parent_id, is_hidden=False)
            .first()
            if parent_id
            else None
        )
    if not notes:
        return None
    notes.reverse()
    people = [_person(notes[0].sender)] + [_person(n.recipient) for n in notes]
    return {
        "people": people,
        "messages": [
            {"from": _person(n.sender)["username"], "message": n.message} for n in notes
        ],
        "length": len(notes),
    }


def status_for(account_id):
    since = timezone.now() - timedelta(hours=24)
    sent_today = GlowNote.objects.filter(sender_id=account_id, created_at__gte=since).count()
    passes = (
        GlowNote.objects.filter(recipient_id=account_id, is_hidden=False)
        .filter(passed_on__isnull=True)
        .count()
    )
    return {
        "daily_limit": DAILY_LIMIT,
        "sent_today": sent_today,
        "remaining_today": max(0, DAILY_LIMIT - sent_today),
        "passes_available": passes,
    }


def _notify(recipient, sender, note):
    ntype, _ = NotificationType.objects.get_or_create(type="glow_note")
    Notification.objects.create(
        status=Notification.UNREAD,
        notif_type=ntype,
        notif_to=recipient,
        notif_from=sender,
        content=f"{_display_name(sender)} sent you a glow “{note.message}”",
    )


def send_glow(sender_id, recipient_id, message):
    message = (message or "").strip()
    if not message:
        raise GlowError("Write a short note to go with your glow.")
    if len(message) > GlowNote.MAX_LENGTH:
        raise GlowError(f"Keep it under {GlowNote.MAX_LENGTH} characters.")
    try:
        recipient_id = int(recipient_id)
    except (TypeError, ValueError):
        raise GlowError("Choose who to send your glow to.")
    if recipient_id == sender_id:
        raise GlowError("You can't send a glow to yourself.")

    recipient = Account.objects.select_related("auth_user").filter(
        id=recipient_id, auth_user__is_active=True
    ).first()
    if not recipient:
        raise GlowError("That person wasn't found.")
    sender = Account.objects.select_related("auth_user").get(id=sender_id)

    since = timezone.now() - timedelta(hours=24)
    sent = GlowNote.objects.filter(sender_id=sender_id, created_at__gte=since)
    if sent.count() >= DAILY_LIMIT:
        raise GlowError(f"You've sent {DAILY_LIMIT} glows today. Come back tomorrow")
    if sent.filter(recipient_id=recipient_id).exists():
        raise GlowError("You already glowed this person today.")

    with transaction.atomic():
        # Pay it forward: use the oldest glow you received but haven't passed on.
        passed_from = (
            GlowNote.objects.select_for_update(of=("self",))
            .filter(recipient_id=sender_id, is_hidden=False, passed_on__isnull=True)
            .order_by("created_at")
            .first()
        )
        note = GlowNote.objects.create(
            sender=sender, recipient=recipient, message=message, passed_from=passed_from
        )
        _notify(recipient, sender, note)

    return serialize_note(note, chain_lengths([note.id]).get(note.id, 1))


def serialize_note(note, chain_length=1):
    return {
        "id": note.id,
        "message": note.message,
        "created_at": time_ago(note.created_at),
        "sender": _person(note.sender),
        "recipient_id": note.recipient_id,
        "chain_length": chain_length,
    }


def wall(account_id, limit=60):
    notes = list(
        GlowNote.objects.select_related("sender__auth_user")
        .filter(recipient_id=account_id, is_hidden=False, sender__auth_user__is_active=True)
        .order_by("-created_at")[:limit]
    )
    lengths = chain_lengths([n.id for n in notes])
    total = GlowNote.objects.filter(recipient_id=account_id, is_hidden=False).count()
    return {
        "count": total,
        "notes": [serialize_note(n, lengths.get(n.id, 1)) for n in notes],
    }


def weekly():
    """Most-glowed people and the longest chain from the last 7 days."""
    since = timezone.now() - timedelta(days=7)
    recent = GlowNote.objects.filter(created_at__gte=since, is_hidden=False)

    top = (
        recent.values("recipient_id")
        .annotate(n=Count("id"))
        .order_by("-n", "recipient_id")[:5]
    )
    accounts = Account.objects.select_related("auth_user").in_bulk(
        [t["recipient_id"] for t in top]
    )
    most_glowed = [
        {**_person(accounts[t["recipient_id"]]), "glows": t["n"]}
        for t in top
        if t["recipient_id"] in accounts
    ]

    ids = list(recent.values_list("id", flat=True)[:2000])
    lengths = chain_lengths(ids)
    longest = None
    if lengths:
        best_id, best_len = max(lengths.items(), key=lambda kv: (kv[1], kv[0]))
        if best_len >= 2:
            longest = chain_for(best_id)

    return {"most_glowed": most_glowed, "longest_chain": longest}

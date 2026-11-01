"""Notify people when their friends posted today:
"Mitch, Rosalio and 2 others posted today."

    python manage.py send_friend_digest            # send
    python manage.py send_friend_digest --dry-run  # print who'd get what

Run once a day (e.g. 7pm, when people are free):
    0 19 * * *  manage.py send_friend_digest

Only counts real people (not bots) and posts the recipient is allowed to
see, and sends at most one digest per person per day.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import connections
from django.utils import timezone

from accounts.models import Account
from notifications.models import Notification, NotificationType
from posts.discover import friend_ids
from posts.visibility import visible_sql

TYPE = "friends_posted"


def _name(row):
    first, last, username = row
    return " ".join(x for x in (first, last) if x) or username


def digest_for(account_id, since):
    """(text, most recent poster id) or None if no friends posted."""
    friends = friend_ids(account_id)
    if not friends:
        return None
    vis, vis_params = visible_sql(account_id)
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"""
            SELECT p.account_id, a.firstname, a.lastname, u.username, MAX(p."dateTime") AS latest
            FROM glow.glow.posts_post p
            JOIN glow.glow.accounts_account a ON a.id = p.account_id
            JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
            WHERE p.account_id = ANY(%s) AND p."dateTime" >= %s
              AND NOT COALESCE(a.is_bot, FALSE) AND {vis}
            GROUP BY p.account_id, a.firstname, a.lastname, u.username
            ORDER BY latest DESC
            """,
            [friends, since, *vis_params],
        )
        rows = cursor.fetchall()
    if not rows:
        return None
    names = [_name(r[1:4]) for r in rows]
    if len(names) == 1:
        text = f"{names[0]} posted today. See what's new."
    elif len(names) == 2:
        text = f"{names[0]} and {names[1]} posted today. See what's new."
    else:
        others = len(names) - 2
        text = f"{names[0]}, {names[1]} and {others} other{'s' if others > 1 else ''} posted today. See what's new."
    return text, rows[0][0]


class Command(BaseCommand):
    help = "Send each person a 'your friends posted today' notification."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, dry_run, **opts):
        now = timezone.now()
        since = now - timedelta(hours=24)
        start_of_day = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)
        ntype, _ = NotificationType.objects.get_or_create(type=TYPE)
        already = set(
            Notification.objects.filter(notif_type=ntype, created_at__gte=start_of_day)
            .values_list("notif_to_id", flat=True)
        )
        sent = 0
        for acc in Account.objects.filter(is_bot=False, auth_user__is_active=True).only("id"):
            if acc.id in already:
                continue
            d = digest_for(acc.id, since)
            if not d:
                continue
            text, from_id = d
            if dry_run:
                self.stdout.write(f"{acc.id}: {text}")
            else:
                Notification.objects.create(
                    status=Notification.UNREAD, notif_type=ntype,
                    notif_to_id=acc.id, notif_from_id=from_id, content=text,
                )
            sent += 1
        self.stdout.write(self.style.SUCCESS(f"{'Would send' if dry_run else 'Sent'} {sent} digest(s)."))

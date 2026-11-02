from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from friends.queries import friend_ids
from GlowProject.db import fetch_column, fetch_tuples
from notifications.queries import create_notification
from posts.visibility import visible_sql

TYPE = "friends_posted"


def _name(row):
    first, last, username = row
    return " ".join(x for x in (first, last) if x) or username


def digest_for(account_id, since):  # (text, most recent poster id), or None if no friends posted
    friends = friend_ids(account_id)
    if not friends:
        return None
    vis, vis_params = visible_sql(account_id)
    rows = fetch_tuples(
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
    help = (
        "Notify people when friends posted today (\"Mitch, Rosalio and 2 others posted today.\"). "
        "Counts real people only and posts the recipient may see; at most one digest per person per day. "
        "Run daily, e.g. 0 19 * * *"
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, dry_run, **opts):
        now = timezone.now()
        start_of_day = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)
        people = fetch_column(
            """
            SELECT a.id
            FROM glow.glow.accounts_account a
            JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
            WHERE u.is_active AND NOT a.is_bot
              AND NOT EXISTS (  -- already got today's digest
                  SELECT 1 FROM glow.glow.notifications_notification n
                  JOIN glow.glow.notifications_notificationtype t ON t.id = n.notif_type_id
                  WHERE n.notif_to_id = a.id AND t.type = %s AND n.created_at >= %s
              )
            """,
            (TYPE, start_of_day),
        )
        sent = 0
        for account_id in people:
            digest = digest_for(account_id, now - timedelta(hours=24))
            if not digest:
                continue
            text, from_id = digest
            if dry_run:
                self.stdout.write(f"{account_id}: {text}")
            else:
                create_notification(TYPE, account_id, from_id, text)
            sent += 1
        self.stdout.write(self.style.SUCCESS(f"{'Would send' if dry_run else 'Sent'} {sent} digest(s)."))

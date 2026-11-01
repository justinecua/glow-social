"""Repair stored glow/comment counts on posts.

The counts are maintained by triggers, so drift should be rare (e.g. rows
changed while triggers were disabled, or a manual SQL fix). Safe to run any
time; only rows whose counts are wrong are updated. Suggested: nightly cron.
"""

from django.core.management.base import BaseCommand
from django.db import connection

FIX = """
WITH actual AS (
    SELECT p.id,
           (SELECT COUNT(*) FROM interactions_glow g WHERE g.post_id = p.id) AS glows,
           (SELECT COUNT(*) FROM interactions_comment c WHERE c.post_id = p.id) AS comments
    FROM posts_post p
)
UPDATE posts_post p
SET glow_count = a.glows, comment_count = a.comments
FROM actual a
WHERE a.id = p.id
  AND (p.glow_count <> a.glows OR p.comment_count <> a.comments)
"""


class Command(BaseCommand):
    help = "Recompute posts' stored glow/comment counts where they've drifted."

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute(FIX)
            self.stdout.write(self.style.SUCCESS(f"Fixed {cursor.rowcount} post(s)."))

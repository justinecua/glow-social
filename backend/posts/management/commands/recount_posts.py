from django.core.management.base import BaseCommand

from GlowProject.db import execute

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
    help = "Recompute posts' stored glow/comment counts where they've drifted (triggers keep them right; safe nightly)."

    def handle(self, *args, **options):
        fixed = execute(FIX)
        self.stdout.write(self.style.SUCCESS(f"Fixed {fixed} post(s)."))

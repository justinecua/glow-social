from django.utils import timezone

from GlowProject.db import execute, fetch_all, fetch_one, fetch_value

from .discover import POST_CODE
from .visibility import can_view_post

REASONS = ("nudity", "harassment", "spam", "violence", "other")


class ReportError(ValueError):  # shown to the user as-is
    pass


def report_post(reporter_id, post_id, reason):
    if not str(post_id).isdigit():
        raise ReportError("Post not found.")
    if reason not in REASONS:
        raise ReportError("Pick a reason.")
    if not can_view_post(post_id, reporter_id):
        raise ReportError("Post not found.")
    author_id = fetch_value("SELECT account_id FROM glow.glow.posts_post WHERE id = %s", (post_id,))
    if author_id == reporter_id:
        raise ReportError("You can't report your own post.")
    execute(
        """
        INSERT INTO glow.glow.posts_postreport (post_id, reporter_id, reason, created_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (post_id, reporter_id) DO NOTHING
        """,  # reporting twice is harmless
        (post_id, reporter_id, reason, timezone.now()),
    )


def reported_posts():  # for `manage.py reports`, most-reported first
    return fetch_all(
        """
        SELECT p.id, p.code, p.caption, u.username,
               COUNT(*) AS report_count,
               MAX(r.created_at) AS last_report,
               ARRAY_AGG(r.reason ORDER BY r.reason) AS reasons
        FROM glow.glow.posts_postreport r
        JOIN glow.glow.posts_post p ON p.id = r.post_id
        JOIN glow.glow.accounts_account a ON a.id = p.account_id
        LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        GROUP BY p.id, p.code, p.caption, u.username
        ORDER BY report_count DESC, last_report DESC
        """
    )


def post_for_review(code):  # any post, whoever can see it: only the owner's commands call this
    if not POST_CODE.fullmatch(str(code)):
        return None
    return fetch_one(
        """
        SELECT p.id, p.code, p.caption, p."dateTime", u.username,
               (SELECT COUNT(*) FROM glow.glow.posts_photo ph WHERE ph.post_id = p.id) AS photo_count,
               (SELECT COUNT(*) FROM glow.glow.posts_postreport r WHERE r.post_id = p.id) AS report_count
        FROM glow.glow.posts_post p
        JOIN glow.glow.accounts_account a ON a.id = p.account_id
        LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE p.code = %s
        """,
        (code,),
    )


def dismiss_reports(post_id):  # the post is fine: forget its reports
    execute("DELETE FROM glow.glow.posts_postreport WHERE post_id = %s", (post_id,))

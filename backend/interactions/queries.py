from django.db import transaction
from django.utils import timezone

from GlowProject.db import execute, fetch_all, fetch_column, fetch_one, fetch_value
from posts.queries import time_ago

MAX_COMMENT_LENGTH = 255

COMMENT_SELECT = """
    SELECT
        c.id AS comment_id,
        c.content AS comment,
        c."dateTime",
        c.parent_id,
        c.account_id,
        (c.edited_at IS NOT NULL) AS edited,
        COALESCE(u.username, '') AS username,
        COALESCE(a.profile_photo, '') AS profile_photo
    FROM glow.glow.interactions_comment c
    LEFT JOIN glow.glow.accounts_account a ON a.id = c.account_id
    LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
"""


class CommentError(ValueError):
    pass


def clean_comment(text):
    text = str(text or "").strip()
    if not text:
        raise CommentError("Comment cannot be empty.")
    if len(text) > MAX_COMMENT_LENGTH:
        raise CommentError(f"Comments can be up to {MAX_COMMENT_LENGTH} characters.")
    return text


def shape_comments(comments):
    for comment in comments:
        comment["dateTime"] = time_ago(comment["dateTime"]) if comment["dateTime"] else ""  # "• 5 mins ago"
    return comments  # parent_id stays null for top-level comments so the app can tell them apart


def find_comment(comment_id):
    found = shape_comments(fetch_all(COMMENT_SELECT + " WHERE c.id = %s", (comment_id,)))
    return found[0] if found else None


def list_comments(post_id):  # oldest first
    return shape_comments(fetch_all(
        COMMENT_SELECT + ''' WHERE c.post_id = %s ORDER BY c."dateTime" ASC, c.id ASC''',
        (post_id,),
    ))


def top_level_parent(parent_id, post_id):  # replies are one level deep: a reply to a reply joins its thread
    parent = fetch_one(
        "SELECT id, parent_id FROM glow.glow.interactions_comment WHERE id = %s AND post_id = %s",
        (parent_id, post_id),
    )
    if not parent:
        raise CommentError("Comment to reply to was not found.")
    return parent["parent_id"] or parent["id"]


def add_comment(text, post_id, account_id, parent_id=None):
    text = clean_comment(text)
    if parent_id:
        parent_id = top_level_parent(parent_id, post_id)

    with transaction.atomic():
        comment_id = fetch_value(
            """
            INSERT INTO glow.glow.interactions_comment
                (content, "dateTime", post_id, account_id, parent_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (text, timezone.now(), post_id, account_id, parent_id or None),
        )
    return {
        "status": "success",
        "message": "Reply added successfully" if parent_id else "Comment added successfully",
        "comment": find_comment(comment_id),
    }


def edit_comment(comment_id, account_id, text):  # only the comment's author can edit it
    text = clean_comment(text)
    updated = execute(
        """
        UPDATE glow.glow.interactions_comment
        SET content = %s, edited_at = %s
        WHERE id = %s AND account_id = %s
        """,
        (text, timezone.now(), comment_id, account_id),
    )
    if not updated:
        return None
    return find_comment(comment_id)


def delete_comment(comment_id, account_id):  # the comment's author, or the post's author, can delete it
    with transaction.atomic():
        allowed = fetch_value(
            """
            SELECT 1 FROM glow.glow.interactions_comment c
            JOIN glow.glow.posts_post p ON p.id = c.post_id
            WHERE c.id = %(c)s AND (c.account_id = %(a)s OR p.account_id = %(a)s)
            """,
            {"c": comment_id, "a": account_id},
        )
        if not allowed:
            return None
        reply_ids = fetch_column(  # foreign keys don't cascade, so replies go first
            "DELETE FROM glow.glow.interactions_comment WHERE parent_id = %s RETURNING id",
            (comment_id,),
        )
        execute("DELETE FROM glow.glow.interactions_comment WHERE id = %s", (comment_id,))
    return [comment_id] + reply_ids

import logging
from django.db import connections, transaction
from rest_framework.response import Response
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from posts.queries import time_ago
from datetime import datetime
import pytz

def countGlows(post_id):
    try:
        query = f"""
                SELECT COUNT(*)
                FROM glow.interactions_glow
                WHERE glow.interactions_glow.post_id = %s
                """
        connection = connections['default']
        cursor = connection.cursor()
        cursor.execute(query, (post_id,))

        results = [
            dict(
                (cursor.description[i][0], value if value is not None else "")
                for i, value in enumerate(row)
            )
            for row in cursor.fetchall()
        ]

        return results

    except Exception as error:
        print(f"Error: {error}")
    finally:        
        if cursor:
            cursor.close()

def getProfileGlows(post_id):
    try:
        query = f"""
                SELECT glow.interactions_glow.id AS glow_id, timestamp, account_id, post_id, firstname, lastname, profile_photo
                FROM glow.interactions_glow
                JOIN glow.accounts_account ON glow.interactions_glow.account_id = glow.accounts_account.id
                WHERE glow.interactions_glow.post_id = %s
                """
        connection = connections['default']
        cursor = connection.cursor()
        cursor.execute(query, (post_id,))

        results = [
            dict(
                (cursor.description[i][0], value if value is not None else "")
                for i, value in enumerate(row)
            )
            for row in cursor.fetchall()
        ]

        return results

    except Exception as error:
        print(f"Error: {error}")
    finally:        
        if cursor:
            cursor.close()

def countComments(post_id):
    try:
        query = f"""
                SELECT COUNT(*) AS total_comments
                FROM glow.interactions_comment
                WHERE glow.interactions_comment.post_id = %s
                """
        connection = connections['default']
        cursor = connection.cursor()
        cursor.execute(query, (post_id,))

        results = [
            dict(
                (cursor.description[i][0], value if value is not None else "")
                for i, value in enumerate(row)
            )
            for row in cursor.fetchall()
        ]

        return results
        
    except Exception as error:
        print(f"Error: {error}")
    finally:        
        if cursor:
            cursor.close()

COMMENT_SELECT = """
    SELECT
        c.id AS comment_id,
        c.content AS comment,
        c."dateTime",
        c.parent_id,
        c.account_id,
        (c.edited_at IS NOT NULL) AS edited,
        u.username,
        a.profile_photo
    FROM glow.glow.interactions_comment AS c
    LEFT JOIN
        glow.glow.accounts_account AS a ON c.account_id = a.id
    LEFT JOIN
        glow.glow.auth_user AS u ON a.auth_user_id = u.id
"""


def _rows_to_comments(cursor):
    columns = [col[0] for col in cursor.description]
    results = []
    for row in cursor.fetchall():
        comment = {
            col: (value if value is not None else "")
            for col, value in zip(columns, row)
        }
        # Keep parent_id as null (not "") so the client can tell top-level apart
        comment["parent_id"] = row[columns.index("parent_id")]
        if isinstance(comment.get("dateTime"), datetime):
            comment["dateTime"] = time_ago(comment["dateTime"])
        results.append(comment)
    return results


# Note: these functions intentionally do NOT call connection.close().
# Django manages the request's DB connection; closing it here forces a fresh
# connection on every query, which made opening a post modal noticeably slow.

def showComments(post_id):
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute(
                COMMENT_SELECT
                + """
                WHERE c.post_id = %s
                ORDER BY c."dateTime" ASC, c.id ASC
                """,
                (post_id,),
            )
            return _rows_to_comments(cursor)
    except Exception as error:
        print(f"Error: {error}")
        return []


def addComment(comment, postId, accID, parentId=None):
    connection = connections["default"]
    try:
        now = datetime.now(pytz.utc)

        with transaction.atomic(), connection.cursor() as cursor:
            # Replies are one level deep: if replying to a reply, attach it to
            # that reply's top-level comment. Parent must belong to the same post.
            if parentId:
                cursor.execute(
                    """
                    SELECT id, parent_id
                    FROM glow.glow.interactions_comment
                    WHERE id = %s AND post_id = %s
                    """,
                    (parentId, postId),
                )
                parent = cursor.fetchone()
                if not parent:
                    return {"status": "error", "message": "Comment to reply to was not found."}
                parentId = parent[1] or parent[0]

            cursor.execute(
                """
                INSERT INTO glow.glow.interactions_comment
                    (content, "dateTime", post_id, account_id, parent_id)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (comment, now, postId, accID, parentId or None),
            )
            new_id = cursor.fetchone()[0]

            cursor.execute(COMMENT_SELECT + " WHERE c.id = %s", (new_id,))
            created = _rows_to_comments(cursor)

        return {
            "status": "success",
            "message": "Reply added successfully" if parentId else "Comment added successfully",
            "comment": created[0] if created else None,
        }

    except Exception as error:
        print(f"Error: {error}")
        return {"status": "error", "message": "Something went wrong."}


def editComment(comment_id, account_id, text):
    """Only the comment's author can edit it."""
    text = (text or "").strip()
    if not text:
        return {"status": 400, "message": "Comment cannot be empty."}
    if len(text) > 255:
        return {"status": 400, "message": "Comments can be up to 255 characters."}
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            UPDATE glow.glow.interactions_comment
            SET content = %s, edited_at = %s
            WHERE id = %s AND account_id = %s
            RETURNING id
            """,
            (text, datetime.now(pytz.utc), comment_id, account_id),
        )
        if not cursor.fetchone():
            return {"status": 404, "message": "Comment not found or not yours."}
        cursor.execute(COMMENT_SELECT + " WHERE c.id = %s", (comment_id,))
        return {"status": 200, "comment": _rows_to_comments(cursor)[0]}


def deleteComment(comment_id, account_id):
    """The comment's author, or the author of the post it's on, can delete
    it. Replies to it are deleted too (FK cascade)."""
    with transaction.atomic(), connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT c.id FROM glow.glow.interactions_comment c
            JOIN glow.glow.posts_post p ON p.id = c.post_id
            WHERE c.id = %s AND (c.account_id = %s OR p.account_id = %s)
            """,
            (comment_id, account_id, account_id),
        )
        if not cursor.fetchone():
            return {"status": 404, "message": "Comment not found or you can't delete it."}
        # Delete replies explicitly (raw SQL bypasses Django's cascade).
        cursor.execute(
            "DELETE FROM glow.glow.interactions_comment WHERE parent_id = %s RETURNING id",
            (comment_id,),
        )
        reply_ids = [r[0] for r in cursor.fetchall()]
        cursor.execute(
            "DELETE FROM glow.glow.interactions_comment WHERE id = %s", (comment_id,)
        )
    return {"status": 200, "deleted_ids": [comment_id] + reply_ids}

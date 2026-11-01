import logging
from django.db import connections
from rest_framework.response import Response
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import datetime
import pytz
from django.http import JsonResponse
import os
from django.conf import settings
import base64


from GlowProject.media import save_image

def time_ago(post_datetime):
    now = datetime.now(pytz.utc)
    time_diff = now - post_datetime

    if time_diff.total_seconds() < 60:
        return "• Just now"
    elif time_diff.total_seconds() < 3600:
        minutes = int(time_diff.total_seconds() / 60)
        return f"• {minutes} min{'s' if minutes != 1 else ''} ago"
    elif time_diff.total_seconds() < 86400:
        hours = int(time_diff.total_seconds() / 3600)
        return f"• {hours} hr{'s' if hours != 1 else ''} ago"
    elif time_diff.total_seconds() < 604800:
        days = int(time_diff.total_seconds() / 86400)
        return f"• {days}d{'' if days != 1 else ''} ago"
    elif time_diff.total_seconds() < 2592000:
        weeks = int(time_diff.total_seconds() / 604800)
        return f"• {weeks} wk{'s' if weeks != 1 else ''} ago"
    elif time_diff.total_seconds() < 31536000:
        months = int(time_diff.total_seconds() / 2592000)
        return f"• {months} mnth{'s' if months != 1 else ''} ago"
    else:
        years = int(time_diff.total_seconds() / 31536000)
        return f"• {years} yr{'s' if years != 1 else ''} ago"


def getPosts(offset=0, limit=7, request=None):
    try:
        query = f"""
            SELECT 
                p.id,
                p.account_id,
                p.caption,
                p."dateTime",
                u.username,
                a.firstname,
                a.lastname,
                a.profile_photo,
                COUNT(DISTINCT glows.id) AS glow_count,
                COUNT(DISTINCT comments.id) AS comment_count,
                ARRAY_AGG(DISTINCT ph.link) AS photos,
                ARRAY_AGG(DISTINCT glows.account_id) AS glowers
            FROM
                glow.glow.posts_post AS p
            LEFT JOIN
                glow.glow.accounts_account AS a ON p.account_id = a.id
            LEFT JOIN
                glow.glow.auth_user AS u ON a.auth_user_id = u.id
            LEFT JOIN
                glow.glow.posts_photo AS ph ON p.id = ph.post_id
            LEFT JOIN
                glow.glow.interactions_glow AS glows ON p.id = glows.post_id
            LEFT JOIN
                glow.glow.interactions_comment AS comments ON p.id = comments.post_id
            GROUP BY 
                p.id, p.account_id, p.caption, p."dateTime", u.username, a.firstname, a.lastname, a.profile_photo
            ORDER BY 
                p."dateTime" DESC
            OFFSET {offset} LIMIT {limit};
        """

        connection = connections["default"]
        cursor = connection.cursor()
        cursor.execute(query)

        results = [
            dict(
                (cursor.description[i][0], value if value is not None else "")
                for i, value in enumerate(row)
            )
            for row in cursor.fetchall()
        ]

        for post in results:
            if "dateTime" in post and isinstance(post["dateTime"], datetime):
                post["dateTime"] = time_ago(post["dateTime"])
            if "photos" in post and isinstance(post["photos"], list):
                post["photos"] = [
                    request.build_absolute_uri(photo) if request and photo else photo
                    for photo in post["photos"]
                    if photo and isinstance(photo, str) and photo.strip()
                ]


        return {'results': results}

    except Exception as error:
        print(f"Error: {error}")
        return {'results': []}
    finally:
        if cursor:
            cursor.close()


def getPostsByUser(account_id, request=None):

    try:
        query = f"""
            SELECT 
                p.id,
                p.account_id,
                p.caption,
                p."dateTime",
                u.username,
                a.firstname,
                a.lastname,
                a.profile_photo,
                COUNT(DISTINCT glows.id) AS glow_count,
                COUNT(DISTINCT comments.id) AS comment_count,
                ARRAY_AGG(DISTINCT ph.link) AS photos,
                ARRAY_AGG(DISTINCT glows.account_id) AS glowers
            FROM
                glow.glow.posts_post AS p
            LEFT JOIN
                glow.glow.accounts_account AS a ON p.account_id = a.id
            LEFT JOIN
                glow.glow.auth_user AS u ON a.auth_user_id = u.id
            LEFT JOIN
                glow.glow.posts_photo AS ph ON p.id = ph.post_id
            LEFT JOIN
                glow.glow.interactions_glow AS glows ON p.id = glows.post_id
            LEFT JOIN
                glow.glow.interactions_comment AS comments ON p.id = comments.post_id
                            WHERE p.account_id = %s
            GROUP BY 
                p.id, p.account_id, p.caption, p."dateTime", u.username, a.firstname, a.lastname, a.profile_photo
            ORDER BY 
                p."dateTime" DESC
        """

        connection = connections["default"]
        cursor = connection.cursor()
        cursor.execute(query,(account_id,))

        results = [
            dict(
                (cursor.description[i][0], value if value is not None else "")
                for i, value in enumerate(row)
            )
            for row in cursor.fetchall()
        ]

        for post in results:
            if "dateTime" in post and isinstance(post["dateTime"], datetime):
                post["dateTime"] = time_ago(post["dateTime"])
            if "photos" in post and isinstance(post["photos"], list):
                post["photos"] = [
                    request.build_absolute_uri(photo) if request and photo else photo
                    for photo in post["photos"]
                    if photo and isinstance(photo, str) and photo.strip()
                ]

        return {'results': results}

    except Exception as error:
        print(f"Error: {error}")
        return {'results': []}
    finally:
        if cursor:
            cursor.close()


def create_post(accID, audience, caption, photos, taglist, request=None):
    connection = None
    cursor = None
    try:
        now = datetime.now(pytz.utc)

        connection = connections["default"]
        cursor = connection.cursor()

        post_query = """
            INSERT INTO glow.glow.posts_post (account_id, audience_id, caption, "dateTime")
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """
        cursor.execute(post_query, (accID, audience, caption, now))
        post_id = cursor.fetchone()[0]

        for tag_name in taglist:
            cursor.execute("SELECT id FROM glow.glow.posts_tag WHERE tag = %s", (tag_name,))
            result = cursor.fetchone()
            tag_id = result[0] if result else None

            if not tag_id:
                cursor.execute("INSERT INTO glow.glow.posts_tag (tag) VALUES (%s) RETURNING id", (tag_name,))
                tag_id = cursor.fetchone()[0]

            cursor.execute("INSERT INTO glow.glow.posts_tag_post (tag_id, post_id) VALUES (%s, %s)", (tag_id, post_id))

        # `photos` are already-validated image bytes (see CreatePost view).
        for image_data in photos:
            media_link = save_image(image_data, "photos")
            cursor.execute("INSERT INTO glow.glow.posts_photo (link, post_id) VALUES (%s, %s)", (media_link, post_id))

        cursor.execute("""
            SELECT u.id, u.username, a.firstname, a.lastname, a.profile_photo
            FROM glow.glow.accounts_account a
            JOIN glow.glow.auth_user u ON a.auth_user_id = u.id
            WHERE a.id = %s
        """, (accID,))
        user_row = cursor.fetchone()
        user_id, username, firstname, lastname, profile_photo = user_row if user_row else (None, "", "", "", "")

        cursor.execute("SELECT id, link FROM glow.posts_photo WHERE post_id = %s", (post_id,))
        photos_data = [request.build_absolute_uri(link) for _, link in cursor.fetchall()]

        cursor.execute("SELECT COUNT(*) FROM glow.glow.interactions_comment WHERE post_id = %s", (post_id,))
        comment_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM glow.glow.interactions_glow WHERE post_id = %s", (post_id,))
        glow_count = cursor.fetchone()[0]

        response = {
            "account_id": accID,
            "caption": caption,
            "comment_count": comment_count,
            "dateTime": time_ago(now),
            "firstname": firstname,
            "lastname": lastname,
            "glow_count": glow_count,
            "glowers": [None],
            "id": post_id,
            "photos": photos_data,
            "profile_photo": profile_photo,
            "username": username
        }

        connection.commit()
        return response

    except Exception as error:
        print(f"Error: {error}")
        if connection:
            connection.rollback()
        return {"status": "error", "message": "Something went wrong."}


    finally:
        if cursor:
            cursor.close()



def sendGlow(accID, postId):
    connection = None
    cursor = None
    try:
        now = datetime.now(pytz.utc)

        connection = connections["default"]
        cursor = connection.cursor()

        # One glow per account per post. The unique constraint makes this
        # safe under double-clicks/retries racing each other.
        glow_query = """
            INSERT INTO glow.glow.interactions_glow (account_id, post_id, "timestamp")
            VALUES (%s, %s, %s)
            ON CONFLICT ON CONSTRAINT glow_one_per_account_post DO NOTHING
        """
        cursor.execute(glow_query, (accID, postId, now))

        connection.commit()
        return {"status": "success", "message": "Post glowed successfully"}

    except Exception as error:
        print(f"Error: {error}")
        if connection:
            connection.rollback()
        return {"status": "error", "message": "Something went wrong."}

    finally:
        if cursor:
            cursor.close()


def sendUnglow(accID, postId):
    connection = None
    cursor = None
    try:
        now = datetime.now(pytz.utc)

        connection = connections["default"]
        cursor = connection.cursor()

        glow_query = """
            DELETE FROM glow.glow.interactions_glow 
            WHERE account_id = %s AND post_id = %s
        """
        cursor.execute(glow_query, (accID, postId))

        connection.commit()
        return {"status": "success", "message": "Post unglowed successfully"}

    except Exception as error:
        print(f"Error: {error}")
        if connection:
            connection.rollback()
        return {"status": "error", "message": "Something went wrong."}

    finally:
        if cursor:
            cursor.close()


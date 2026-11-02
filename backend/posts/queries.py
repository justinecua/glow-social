from datetime import datetime

import pytz
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone

from GlowProject.db import execute, fetch_column, fetch_one, fetch_value
from GlowProject.media import save_image

AUDIENCES = ("public", "friends", "close_friends", "only_me")
MAX_CAPTION = 800


def time_ago(when):  # "• 5 mins ago"
    seconds = (datetime.now(pytz.utc) - when).total_seconds()
    if seconds < 60:
        return "• Just now"
    if seconds < 3600:
        minutes = int(seconds / 60)
        return f"• {minutes} min{'s' if minutes != 1 else ''} ago"
    if seconds < 86400:
        hours = int(seconds / 3600)
        return f"• {hours} hr{'s' if hours != 1 else ''} ago"
    if seconds < 604800:
        return f"• {int(seconds / 86400)}d ago"
    if seconds < 2592000:
        weeks = int(seconds / 604800)
        return f"• {weeks} wk{'s' if weeks != 1 else ''} ago"
    if seconds < 31536000:
        months = int(seconds / 2592000)
        return f"• {months} mnth{'s' if months != 1 else ''} ago"
    years = int(seconds / 31536000)
    return f"• {years} yr{'s' if years != 1 else ''} ago"


def insert_post(account_id, audience_id, caption):
    return fetch_value(
        """
        INSERT INTO glow.glow.posts_post (account_id, audience_id, caption, "dateTime")
        VALUES (%s, %s, %s, %s)
        RETURNING id
        """,
        (account_id, audience_id, caption, timezone.now()),
    )


def tag_id(name):  # creates the tag the first time it's used
    existing = fetch_value("SELECT id FROM glow.glow.posts_tag WHERE tag = %s LIMIT 1", (name,))
    if existing:
        return existing
    return fetch_value("INSERT INTO glow.glow.posts_tag (tag) VALUES (%s) RETURNING id", (name,))


def add_tags(post_id, names):
    for name in names:
        execute(
            "INSERT INTO glow.glow.posts_tag_post (tag_id, post_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (tag_id(name), post_id),
        )


def add_photo(post_id, link):
    execute("INSERT INTO glow.glow.posts_photo (link, post_id) VALUES (%s, %s)", (link, post_id))


def create_post(account_id, audience_id, caption, photos, tags, request=None):  # `photos` are validated image bytes
    with transaction.atomic():
        post_id = insert_post(account_id, audience_id, caption)
        add_tags(post_id, tags)
        for image in photos:
            add_photo(post_id, save_image(image, "photos"))

    author = fetch_one(
        """
        SELECT u.username, a.firstname, a.lastname, a.profile_photo
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.id = %s
        """,
        (account_id,),
    )
    links = fetch_column("SELECT link FROM glow.glow.posts_photo WHERE post_id = %s ORDER BY id", (post_id,))
    return {  # same shape as a feed post, so the app can show it right away
        "id": post_id,
        "account_id": account_id,
        "caption": caption,
        "dateTime": "• Just now",
        "username": author["username"],
        "firstname": author["firstname"],
        "lastname": author["lastname"],
        "profile_photo": author["profile_photo"],
        "photos": [request.build_absolute_uri(link) if request else link for link in links],
        "glow_count": 0,
        "comment_count": 0,
        "glowers": [None],
    }


def glow_post(account_id, post_id):
    execute(
        """
        INSERT INTO glow.glow.interactions_glow (account_id, post_id, "timestamp")
        VALUES (%s, %s, %s)
        ON CONFLICT ON CONSTRAINT glow_one_per_account_post DO NOTHING
        """,  # one glow per person per post, even with double-clicks
        (account_id, post_id, timezone.now()),
    )
    return {"status": "success", "message": "Post glowed successfully"}


def unglow_post(account_id, post_id):
    execute(
        "DELETE FROM glow.glow.interactions_glow WHERE account_id = %s AND post_id = %s",
        (account_id, post_id),
    )
    return {"status": "success", "message": "Post unglowed successfully"}


def find_own_post(post_id, account_id):
    return fetch_one(
        """
        SELECT p.id, p.caption,
               EXISTS (SELECT 1 FROM glow.glow.posts_photo ph WHERE ph.post_id = p.id) AS has_photos
        FROM glow.glow.posts_post p
        WHERE p.id = %s AND p.account_id = %s
        """,
        (post_id, account_id),
    )


def update_post(post_id, caption=None, audience_id=None):
    if caption is not None:
        execute("UPDATE glow.glow.posts_post SET caption = %s WHERE id = %s", (caption, post_id))
    if audience_id is not None:
        execute("UPDATE glow.glow.posts_post SET audience_id = %s WHERE id = %s", (audience_id, post_id))


THIS_POSTS_POLL = "(SELECT id FROM glow.glow.posts_poll WHERE post_id = %(p)s)"
THIS_POSTS_GAME = "(SELECT id FROM glow.glow.games_playsession WHERE post_id = %(p)s)"

DELETE_POST = [  # children before the post; foreign keys don't cascade
    "UPDATE glow.glow.posts_poll SET correct_option_id = NULL WHERE post_id = %(p)s",
    f"DELETE FROM glow.glow.posts_pollvote WHERE poll_id IN {THIS_POSTS_POLL}",
    f"DELETE FROM glow.glow.posts_polloption WHERE poll_id IN {THIS_POSTS_POLL}",
    "DELETE FROM glow.glow.posts_poll WHERE post_id = %(p)s",
    f"DELETE FROM glow.glow.games_playsessionplayer WHERE session_id IN {THIS_POSTS_GAME}",
    "DELETE FROM glow.glow.games_playsession WHERE post_id = %(p)s",
    """
    WITH RECURSIVE doomed AS (
        SELECT id FROM glow.glow.interactions_comment WHERE post_id = %(p)s
        UNION
        SELECT c.id FROM glow.glow.interactions_comment c JOIN doomed d ON c.parent_id = d.id
    )
    DELETE FROM glow.glow.interactions_comment WHERE id IN (SELECT id FROM doomed)
    """,
    "DELETE FROM glow.glow.interactions_glow WHERE post_id = %(p)s",
    "DELETE FROM glow.glow.interactions_share WHERE post_id = %(p)s",
    "DELETE FROM glow.glow.posts_postseen WHERE post_id = %(p)s",
    "DELETE FROM glow.glow.posts_photo WHERE post_id = %(p)s",
    "DELETE FROM glow.glow.posts_video WHERE post_id = %(p)s",
    "DELETE FROM glow.glow.posts_tag_post WHERE post_id = %(p)s",
    "DELETE FROM glow.glow.posts_post WHERE id = %(p)s",
]


def delete_post(post_id):  # returns the photo links so the caller can delete the files
    links = fetch_column("SELECT link FROM glow.glow.posts_photo WHERE post_id = %s", (post_id,))
    with transaction.atomic():
        for sql in DELETE_POST:
            execute(sql, {"p": post_id})
    return links


def bot_account_id(username, first, last, bio):  # creates the bot the first time; bots can't log in
    with transaction.atomic():
        user_id = fetch_value("SELECT id FROM glow.glow.auth_user WHERE username = %s", (username,))
        if not user_id:
            user_id = fetch_value(
                """
                INSERT INTO glow.glow.auth_user
                    (username, email, password, date_joined, is_superuser,
                     first_name, last_name, is_staff, is_active)
                VALUES (%s, '', %s, %s, false, '', '', false, true)
                RETURNING id
                """,
                (username, make_password(None), timezone.now()),  # make_password(None) = unusable password
            )
        account_id = fetch_value("SELECT id FROM glow.glow.accounts_account WHERE auth_user_id = %s", (user_id,))
        if account_id:
            execute("UPDATE glow.glow.accounts_account SET is_bot = TRUE WHERE id = %s", (account_id,))
            return account_id
        return fetch_value(
            """
            INSERT INTO glow.glow.accounts_account
                (auth_user_id, firstname, lastname, bio, is_bot,
                 gender, ui_appearance, cover_photo, is_online, terms_version, marketing_opt_in)
            VALUES (%s, %s, %s, %s, TRUE, '', '', '', FALSE, '', FALSE)
            RETURNING id
            """,
            (user_id, first, last, bio),
        )

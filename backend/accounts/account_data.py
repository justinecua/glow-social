import logging

from django.core.cache import cache
from django.db import transaction

from GlowProject.db import execute, fetch_all, fetch_column, fetch_one
from GlowProject.media import delete_media

logger = logging.getLogger(__name__)


def iso_dates(rows):  # dates become text so the export is plain JSON
    for row in rows:
        for key, value in row.items():
            if hasattr(value, "isoformat"):
                row[key] = value.isoformat()
    return rows


def rows(sql, account_id):
    return iso_dates(fetch_all(sql, {"a": account_id}))


def export_user_data(user):  # GDPR / Data Privacy Act access request
    data = {
        "user": iso_dates([fetch_one(
            "SELECT username, email, date_joined, last_login FROM glow.glow.auth_user WHERE id = %s",
            (user.pk,),
        )])[0],
        "profile": None,
    }
    profile = fetch_one(
        """
        SELECT id, firstname, lastname, gender, birthday, bio, profile_photo, cover_photo,
               terms_version, terms_accepted_at, marketing_opt_in, marketing_opt_in_at
        FROM glow.glow.accounts_account
        WHERE auth_user_id = %s
        """,
        (user.pk,),
    )
    if not profile:
        return data

    a = profile.pop("id")
    data["profile"] = iso_dates([profile])[0]
    data["posts"] = rows(
        """
        SELECT p.id, p.caption, p."dateTime" AS created_at,
               ARRAY(SELECT ph.link FROM glow.glow.posts_photo ph WHERE ph.post_id = p.id ORDER BY ph.id) AS photos
        FROM glow.glow.posts_post p
        WHERE p.account_id = %(a)s
        ORDER BY p."dateTime"
        """,
        a,
    )
    data["comments"] = rows(
        """
        SELECT post_id, content, parent_id AS reply_to_comment_id, "dateTime" AS created_at
        FROM glow.glow.interactions_comment
        WHERE account_id = %(a)s
        ORDER BY "dateTime"
        """,
        a,
    )
    data["glows"] = rows(
        "SELECT post_id, timestamp AS created_at FROM glow.glow.interactions_glow WHERE account_id = %(a)s",
        a,
    )
    data["shares"] = rows(
        "SELECT post_id, caption, timestamp AS created_at FROM glow.glow.interactions_share WHERE account_id = %(a)s",
        a,
    )
    data["sparks"] = rows(
        """
        SELECT text, photo, background, close_friends_only, created_at, expires_at
        FROM glow.glow.sparks_spark
        WHERE account_id = %(a)s
        ORDER BY created_at
        """,
        a,
    )
    data["poll_votes"] = rows(
        """
        SELECT p.post_id, o.text AS answer, v.created_at
        FROM glow.glow.posts_pollvote v
        JOIN glow.glow.posts_polloption o ON o.id = v.option_id
        JOIN glow.glow.posts_poll p ON p.id = v.poll_id
        WHERE v.account_id = %(a)s
        """,
        a,
    )
    data["friends"] = rows(
        """
        SELECT u.username, f.status, f.date_friend_request AS requested_at,
               f.date_became_friends AS became_friends_at
        FROM glow.glow.friends_friend f
        JOIN glow.glow.accounts_account o
          ON o.id = CASE WHEN f.user_id = %(a)s THEN f.friend_id ELSE f.user_id END
        LEFT JOIN glow.glow.auth_user u ON u.id = o.auth_user_id
        WHERE f.user_id = %(a)s OR f.friend_id = %(a)s
        """,
        a,
    )
    data["close_friends"] = fetch_column(
        """
        SELECT u.username
        FROM glow.glow.friends_closefriend c
        JOIN glow.glow.accounts_account o ON o.id = c.friend_id
        LEFT JOIN glow.glow.auth_user u ON u.id = o.auth_user_id
        WHERE c.owner_id = %(a)s
        """,
        {"a": a},
    )
    data["people_invited"] = fetch_column(
        """
        SELECT u.username
        FROM glow.glow.accounts_account o
        JOIN glow.glow.auth_user u ON u.id = o.auth_user_id
        WHERE o.invited_by_id = %(a)s
        """,
        {"a": a},
    )
    data["messages_sent"] = rows(
        """
        SELECT conversation_id, body, created_at
        FROM glow.glow.messaging_message
        WHERE sender_id = %(a)s AND NOT is_deleted
        ORDER BY created_at
        """,
        a,
    )
    data["glows_sent"] = rows(
        """
        SELECT u.username AS "to", g.message, g.created_at
        FROM glow.glow.kudos_glownote g
        JOIN glow.glow.accounts_account o ON o.id = g.recipient_id
        LEFT JOIN glow.glow.auth_user u ON u.id = o.auth_user_id
        WHERE g.sender_id = %(a)s
        """,
        a,
    )
    data["glows_received"] = rows(
        """
        SELECT u.username AS "from", g.message, g.created_at
        FROM glow.glow.kudos_glownote g
        JOIN glow.glow.accounts_account o ON o.id = g.sender_id
        LEFT JOIN glow.glow.auth_user u ON u.id = o.auth_user_id
        WHERE g.recipient_id = %(a)s
        """,
        a,
    )
    data["notifications"] = rows(
        "SELECT content, status, created_at FROM glow.glow.notifications_notification WHERE notif_to_id = %(a)s",
        a,
    )
    return data


def _media_links(account_id):  # every uploaded file the account owns
    return fetch_column(
        """
        SELECT link FROM (
            SELECT ph.link FROM glow.glow.posts_photo ph
            JOIN glow.glow.posts_post p ON p.id = ph.post_id WHERE p.account_id = %(a)s
            UNION ALL
            SELECT photo FROM glow.glow.sparks_spark WHERE account_id = %(a)s
            UNION ALL
            SELECT profile_photo FROM glow.glow.accounts_account WHERE id = %(a)s
            UNION ALL
            SELECT cover_photo FROM glow.glow.accounts_account WHERE id = %(a)s
        ) links WHERE COALESCE(link, '') <> ''
        """,
        {"a": account_id},
    )


MY_POSTS = "(SELECT id FROM glow.glow.posts_post WHERE account_id = %(a)s)"
MY_POLLS = f"(SELECT id FROM glow.glow.posts_poll WHERE post_id IN {MY_POSTS})"
MY_SPARKS = "(SELECT id FROM glow.glow.sparks_spark WHERE account_id = %(a)s)"
MY_NOTES = "(SELECT id FROM glow.glow.kudos_glownote WHERE sender_id = %(a)s OR recipient_id = %(a)s)"

DELETE_ACCOUNT = [  # children before parents; FKs are NO ACTION so a missed table aborts the whole delete
    f"UPDATE glow.glow.posts_poll SET correct_option_id = NULL WHERE id IN {MY_POLLS}",
    f"DELETE FROM glow.glow.posts_pollvote WHERE account_id = %(a)s OR poll_id IN {MY_POLLS}",
    f"DELETE FROM glow.glow.posts_polloption WHERE poll_id IN {MY_POLLS}",
    f"DELETE FROM glow.glow.posts_poll WHERE id IN {MY_POLLS}",
    f"""
    WITH RECURSIVE doomed AS (
        SELECT id FROM glow.glow.interactions_comment WHERE account_id = %(a)s OR post_id IN {MY_POSTS}
        UNION
        SELECT c.id FROM glow.glow.interactions_comment c JOIN doomed d ON c.parent_id = d.id
    )
    DELETE FROM glow.glow.interactions_comment WHERE id IN (SELECT id FROM doomed)
    """,
    f"DELETE FROM glow.glow.interactions_glow WHERE account_id = %(a)s OR post_id IN {MY_POSTS}",
    f"DELETE FROM glow.glow.interactions_share WHERE account_id = %(a)s OR post_id IN {MY_POSTS}",
    f"DELETE FROM glow.glow.posts_postseen WHERE account_id = %(a)s OR post_id IN {MY_POSTS}",
    f"DELETE FROM glow.glow.posts_photo WHERE post_id IN {MY_POSTS}",
    f"DELETE FROM glow.glow.posts_video WHERE post_id IN {MY_POSTS}",
    f"DELETE FROM glow.glow.posts_tag_post WHERE post_id IN {MY_POSTS}",
    "DELETE FROM glow.glow.posts_post WHERE account_id = %(a)s",
    f"DELETE FROM glow.glow.sparks_sparkview WHERE account_id = %(a)s OR spark_id IN {MY_SPARKS}",
    f"DELETE FROM glow.glow.sparks_sparkwarm WHERE account_id = %(a)s OR spark_id IN {MY_SPARKS}",
    "DELETE FROM glow.glow.sparks_spark WHERE account_id = %(a)s",
    f"UPDATE glow.glow.kudos_glownote SET passed_from_id = NULL WHERE passed_from_id IN {MY_NOTES}",
    "DELETE FROM glow.glow.kudos_glownote WHERE sender_id = %(a)s OR recipient_id = %(a)s",
    "DELETE FROM glow.glow.messaging_message WHERE sender_id = %(a)s",
    "DELETE FROM glow.glow.messaging_conversationmember WHERE account_id = %(a)s",
    "UPDATE glow.glow.messaging_conversation SET created_by_id = NULL WHERE created_by_id = %(a)s",
    "DELETE FROM glow.glow.friends_closefriend WHERE owner_id = %(a)s OR friend_id = %(a)s",
    "DELETE FROM glow.glow.friends_friend WHERE user_id = %(a)s OR friend_id = %(a)s",
    "DELETE FROM glow.glow.notifications_notification WHERE notif_to_id = %(a)s OR notif_from_id = %(a)s",
    "UPDATE glow.glow.accounts_account SET invited_by_id = NULL WHERE invited_by_id = %(a)s",
    "DELETE FROM glow.glow.accounts_account WHERE id = %(a)s",
]

DELETE_USER = [
    "DELETE FROM glow.glow.accounts_passwordreset WHERE user_id = %(u)s",
    "DELETE FROM glow.glow.django_admin_log WHERE user_id = %(u)s",
    "DELETE FROM glow.glow.auth_user_groups WHERE user_id = %(u)s",
    "DELETE FROM glow.glow.auth_user_user_permissions WHERE user_id = %(u)s",
    "UPDATE glow.glow.token_blacklist_outstandingtoken SET user_id = NULL WHERE user_id = %(u)s",
    """
    DELETE FROM glow.glow.socialaccount_socialtoken WHERE account_id IN
        (SELECT id FROM glow.glow.socialaccount_socialaccount WHERE user_id = %(u)s)
    """,
    "DELETE FROM glow.glow.socialaccount_socialaccount WHERE user_id = %(u)s",
    """
    DELETE FROM glow.glow.account_emailconfirmation WHERE email_address_id IN
        (SELECT id FROM glow.glow.account_emailaddress WHERE user_id = %(u)s)
    """,
    "DELETE FROM glow.glow.account_emailaddress WHERE user_id = %(u)s",
    "DELETE FROM glow.glow.auth_user WHERE id = %(u)s",
]


def delete_user_account(user):  # GDPR erasure: the user and everything their account owns
    account_id = fetch_one("SELECT id FROM glow.glow.accounts_account WHERE auth_user_id = %s", (user.pk,))
    account_id = account_id["id"] if account_id else None
    links = _media_links(account_id) if account_id else []

    with transaction.atomic():
        if account_id:
            for sql in DELETE_ACCOUNT:
                execute(sql, {"a": account_id})
        for sql in DELETE_USER:
            execute(sql, {"u": user.pk})

    try:
        cache.delete(f"account_id_for_user:{user.pk}")  # see auth_utils.account_id_for_user
    except Exception:
        logger.warning("Could not clear cached account id for user %s", user.pk)  # Redis down

    for link in links:
        delete_media(link)  # only files in our storage; outside links are ignored

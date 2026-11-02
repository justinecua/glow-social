from django.db import transaction
from django.utils import timezone

from GlowProject.db import execute, fetch_all, fetch_column, fetch_one, fetch_value
from notifications.queries import create_notification

NOTIFICATION_TYPE_ID = """
    (SELECT id FROM glow.glow.notifications_notificationtype WHERE type = %s LIMIT 1)
"""


def friend_ids(account_id):  # everyone this account is friends with
    if not account_id:
        return []
    return fetch_column(
        """
        SELECT CASE WHEN user_id = %(me)s THEN friend_id ELSE user_id END
        FROM glow.glow.friends_friend
        WHERE status = 'Friends' AND (user_id = %(me)s OR friend_id = %(me)s)
        """,
        {"me": account_id},
    )


def are_friends(a_id, b_id):
    return fetch_value(
        """
        SELECT 1 FROM glow.glow.friends_friend
        WHERE status = 'Friends'
          AND ((user_id = %(a)s AND friend_id = %(b)s) OR (user_id = %(b)s AND friend_id = %(a)s))
        """,
        {"a": a_id, "b": b_id},
    ) is not None


def count_friends(account_id):
    return fetch_value(
        """
        SELECT COUNT(*) FROM glow.glow.friends_friend
        WHERE status = 'Friends' AND (user_id = %(me)s OR friend_id = %(me)s)
        """,
        {"me": account_id},
        default=0,
    )


def find_friendship(account_id, other_id):  # the request or friendship between two people, either direction
    return fetch_one(
        """
        SELECT * FROM glow.glow.friends_friend
        WHERE (user_id = %(a)s AND friend_id = %(b)s) OR (user_id = %(b)s AND friend_id = %(a)s)
        """,
        {"a": account_id, "b": other_id},
        blank_nulls=True,
    )


def display_name(account_id):  # first + last name, else the username
    person = fetch_one(
        """
        SELECT a.firstname, a.lastname, u.username
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.id = %s
        """,
        (account_id,),
    )
    if not person:
        return "Someone"
    full_name = " ".join(filter(None, [person["firstname"], person["lastname"]]))
    return full_name or person["username"]


def is_active_person(account_id):
    return fetch_value(
        """
        SELECT 1 FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.id = %s AND u.is_active AND NOT a.is_bot
        """,
        (account_id,),
    ) is not None


def delete_request_notifications(a_id, b_id):  # read or not, between these two people
    execute(
        f"""
        DELETE FROM glow.glow.notifications_notification
        WHERE ((notif_to_id = %s AND notif_from_id = %s) OR (notif_to_id = %s AND notif_from_id = %s))
          AND notif_type_id = {NOTIFICATION_TYPE_ID}
        """,
        (a_id, b_id, b_id, a_id, "friend_request"),
    )


def add_friend(friend_id, user_id):  # user_id sends a request to friend_id
    if not is_active_person(friend_id):
        return {"status": "error", "message": "That person wasn't found."}

    with transaction.atomic():
        if find_friendship(user_id, friend_id):
            return {"status": "error", "message": "Friend request already exists or you are already friends."}
        execute(
            """
            INSERT INTO glow.glow.friends_friend (status, date_friend_request, friend_id, user_id)
            VALUES ('Pending', %s, %s, %s)
            """,
            (timezone.now(), friend_id, user_id),
        )
        delete_request_notifications(friend_id, user_id)  # one request notification per person
        create_notification("friend_request", friend_id, user_id, f"{display_name(user_id)} sent you a friend request")

    return {"status": "success", "message": "Friend request sent successfully."}


def cancel_friend_request(friend_id, user_id):  # cancel your request, or decline theirs
    with transaction.atomic():
        execute(
            """
            DELETE FROM glow.glow.friends_friend
            WHERE ((friend_id = %s AND user_id = %s) OR (friend_id = %s AND user_id = %s))
              AND status = 'Pending'
            """,
            (friend_id, user_id, user_id, friend_id),
        )
        delete_request_notifications(friend_id, user_id)
    return {"status": "success", "message": "Friend request canceled or removed."}


def accept_friend(friend_id, user_id):  # user_id accepts the request friend_id sent
    with transaction.atomic():
        accepted = execute(
            """
            UPDATE glow.glow.friends_friend
            SET status = 'Friends', date_became_friends = %s
            WHERE user_id = %s AND friend_id = %s AND status = 'Pending'
            """,
            (timezone.now(), friend_id, user_id),
        ) > 0
        if not accepted:
            return {"status": "error", "message": "No pending request."}

        execute(
            f"""
            UPDATE glow.glow.notifications_notification SET status = 'Read'
            WHERE notif_to_id = %s AND notif_from_id = %s AND status = 'Unread'
              AND notif_type_id = {NOTIFICATION_TYPE_ID}
            """,
            (user_id, friend_id, "friend_request"),
        )
        create_notification("friend_accepted", friend_id, user_id, f"{display_name(user_id)} accepted your friend request")

    return {"status": "success", "message": "Friend request accepted."}


def unfriend(friend_id, user_id):
    with transaction.atomic():
        execute(
            """
            DELETE FROM glow.glow.friends_friend
            WHERE (friend_id = %s AND user_id = %s) OR (friend_id = %s AND user_id = %s)
            """,
            (friend_id, user_id, user_id, friend_id),
        )
        execute(
            """
            DELETE FROM glow.glow.friends_closefriend
            WHERE (owner_id = %s AND friend_id = %s) OR (owner_id = %s AND friend_id = %s)
            """,
            (friend_id, user_id, user_id, friend_id),
        )
        delete_request_notifications(friend_id, user_id)
    return {"status": "success", "message": "You are no longer friends."}


def add_close_friend(owner_id, friend_id):
    execute(
        """
        INSERT INTO glow.glow.friends_closefriend (owner_id, friend_id, created_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (owner_id, friend_id) DO NOTHING
        """,
        (owner_id, friend_id, timezone.now()),
    )


def remove_close_friend(owner_id, friend_id):
    execute(
        "DELETE FROM glow.glow.friends_closefriend WHERE owner_id = %s AND friend_id = %s",
        (owner_id, friend_id),
    )


def my_friends(account_id):  # friends, plus requests you sent and received
    rows = fetch_all(
        """
        SELECT
            CASE WHEN f.user_id = %(me)s THEN f.friend_id ELSE f.user_id END AS id,
            u.username,
            COALESCE(a.firstname, '') AS firstname,
            COALESCE(a.lastname, '') AS lastname,
            COALESCE(a.profile_photo, '') AS profile_photo,
            f.status,
            CASE WHEN f.user_id = %(me)s THEN 'outgoing' ELSE 'incoming' END AS direction,
            EXISTS (
                SELECT 1 FROM glow.glow.friends_closefriend c
                WHERE c.owner_id = %(me)s
                  AND c.friend_id = CASE WHEN f.user_id = %(me)s THEN f.friend_id ELSE f.user_id END
            ) AS is_close,
            f.date_friend_request,
            f.date_became_friends
        FROM glow.glow.friends_friend f
        JOIN glow.glow.accounts_account a
          ON a.id = CASE WHEN f.user_id = %(me)s THEN f.friend_id ELSE f.user_id END
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE (f.user_id = %(me)s OR f.friend_id = %(me)s)
          AND f.status IN ('Friends', 'Pending')
        ORDER BY COALESCE(f.date_became_friends, f.date_friend_request) DESC
        """,
        {"me": account_id},
    )

    result = {"friends": [], "incoming": [], "outgoing": []}
    for row in rows:
        for key in ("date_friend_request", "date_became_friends"):
            row[key] = row[key].isoformat() if row[key] else None
        group = "friends" if row["status"] == "Friends" else row["direction"]
        result[group].append(row)
    return result


def people_you_may_know(account_id, limit=5):  # friends of friends first, then recently active people
    people = fetch_all(
        """
        WITH mine AS (
            SELECT CASE WHEN user_id = %(me)s THEN friend_id ELSE user_id END AS id
            FROM glow.glow.friends_friend
            WHERE status = 'Friends' AND (user_id = %(me)s OR friend_id = %(me)s)
        ),
        known AS (  -- anyone you already have a request or friendship with
            SELECT CASE WHEN user_id = %(me)s THEN friend_id ELSE user_id END AS id
            FROM glow.glow.friends_friend
            WHERE user_id = %(me)s OR friend_id = %(me)s
        ),
        friends_of_friends AS (
            SELECT CASE WHEN f.user_id = m.id THEN f.friend_id ELSE f.user_id END AS id,
                   m.id AS via
            FROM glow.glow.friends_friend f
            JOIN mine m ON f.user_id = m.id OR f.friend_id = m.id
            WHERE f.status = 'Friends'
        )
        SELECT a.id, u.username,
               COALESCE(a.firstname, '') AS firstname,
               COALESCE(a.lastname, '') AS lastname,
               COALESCE(a.profile_photo, '') AS profile_photo,
               COUNT(DISTINCT fof.via) AS mutual_count
        FROM friends_of_friends fof
        JOIN glow.glow.accounts_account a ON a.id = fof.id
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE u.is_active
          AND NOT a.is_bot
          AND fof.id <> %(me)s
          AND fof.id NOT IN (SELECT id FROM known)
        GROUP BY a.id, u.username, a.firstname, a.lastname, a.profile_photo
        ORDER BY mutual_count DESC, a.id DESC
        LIMIT %(limit)s
        """,
        {"me": account_id, "limit": limit},
    )
    if len(people) >= limit:
        return people

    already_listed = [account_id] + [p["id"] for p in people]
    people += fetch_all(
        """
        SELECT a.id, u.username,
               COALESCE(a.firstname, '') AS firstname,
               COALESCE(a.lastname, '') AS lastname,
               COALESCE(a.profile_photo, '') AS profile_photo,
               0 AS mutual_count
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        LEFT JOIN glow.glow.posts_post p ON p.account_id = a.id
        WHERE u.is_active
          AND NOT a.is_bot
          AND NOT (a.id = ANY(%(skip)s))
          AND a.id NOT IN (
              SELECT CASE WHEN user_id = %(me)s THEN friend_id ELSE user_id END
              FROM glow.glow.friends_friend
              WHERE user_id = %(me)s OR friend_id = %(me)s
          )
        GROUP BY a.id, u.username, a.firstname, a.lastname, a.profile_photo
        ORDER BY MAX(p."dateTime") DESC NULLS LAST, a.id DESC
        LIMIT %(n)s
        """,
        {"me": account_id, "skip": already_listed, "n": limit - len(people)},
    )
    return people

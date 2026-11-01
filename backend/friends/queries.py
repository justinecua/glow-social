
from django.db import connections
from rest_framework.response import Response
from django.utils import timezone
from django.conf import settings
from datetime import datetime
import pytz
from django.db import connections

def getTotalFriends(account_id):
    try:
        query = f"""
            SELECT COUNT(*) AS total_friends
            FROM glow.friends_friend
            WHERE status = 'Friends' AND (user_id = %s OR friend_id = %s);
                """
        connection = connections['default']
        cursor = connection.cursor()
        cursor.execute(query, (account_id, account_id))
        result = cursor.fetchone()
        return result[0] if result else 0 

    except Exception as error:
        print(f"Error: {error}")
    finally:        
        if cursor:
            cursor.close()

def getFriendList(account_id):
    try:
        query = f"""
            SELECT * AS total_friends
            FROM glow.friends_friend
            WHERE status = 'Friends' AND (user_id = %s OR friend_id = %s);
                """
        connection = connections['default']
        cursor = connection.cursor()
        cursor.execute(query, (account_id, account_id))
        result = cursor.fetchone()
        return result[0] if result else 0 

    except Exception as error:
        print(f"Error: {error}")
    finally:        
        if cursor:
            cursor.close()

def _display_name(cursor, account_id):
    """First + last name, else the username: never just "Someone"."""
    cursor.execute(
        """
        SELECT a.firstname, a.lastname, u.username
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.id = %s
        """,
        (account_id,),
    )
    row = cursor.fetchone()
    if not row:
        return "Someone"
    first, last, username = row
    return " ".join(filter(None, [first, last])) or username or "Someone"


def addFriend(friend_id, user_id):
    try:
        now = datetime.now(pytz.utc)
        status = "Pending"

        connection = connections["default"]
        cursor = connection.cursor()

        # Block duplicates in either direction (A->B or B->A).
        cursor.execute(
            """
            SELECT 1 FROM glow.glow.friends_friend
            WHERE (user_id = %s AND friend_id = %s) OR (user_id = %s AND friend_id = %s)
            LIMIT 1
            """,
            (user_id, friend_id, friend_id, user_id),
        )
        if cursor.fetchone():
            return {"status": "error", "message": "Friend request already exists or you are already friends."}

        friend_query = """
            INSERT INTO glow.glow.friends_friend (status, date_friend_request, friend_id, user_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """
        cursor.execute(friend_query, (status, now, friend_id, user_id))
        friend_request_id = cursor.fetchone()[0]

        notif_type_query = """
            SELECT id FROM glow.glow.notifications_notificationtype WHERE type = %s LIMIT 1
        """
        cursor.execute(notif_type_query, ("friend_request",))
        notif_type_id = cursor.fetchone()
        if not notif_type_id:
            raise Exception("Notification type 'friend_request' not found.")
        notif_type_id = notif_type_id[0]

        user_name = _display_name(cursor, user_id)

        notif_content = f"{user_name} sent you a friend request"

        # One request notification per person: drop any older one first.
        cursor.execute(
            """
            DELETE FROM glow.glow.notifications_notification
            WHERE notif_to_id = %s AND notif_from_id = %s AND notif_type_id = %s
            """,
            (friend_id, user_id, notif_type_id),
        )

        notif_query = """
            INSERT INTO glow.glow.notifications_notification (status, notif_type_id, notif_to_id, notif_from_id, content, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            notif_query,
            ("Unread", notif_type_id, friend_id, user_id, notif_content, now),
        )

        connection.commit()
        return {"status": "success", "message": "Friend request sent successfully."}

    except Exception as error:
        print(f"Error: {error}")
    finally:        
        if cursor:
            cursor.close()


def cancelFriendRequest(friend_id, user_id):
    try:
        connection = connections["default"]
        cursor = connection.cursor()

        delete_query = """
            DELETE FROM glow.glow.friends_friend 
            WHERE ((friend_id = %s AND user_id = %s) OR (friend_id = %s AND user_id = %s))
              AND status = 'Pending'
        """
        cursor.execute(delete_query, (friend_id, user_id, user_id, friend_id))

        # The request is gone, so its notification goes too (read or not).
        # Only friend-request notifications: an unread glow from them stays.
        delete_notif_query = f"""
            DELETE FROM glow.glow.notifications_notification
            WHERE ((notif_to_id = %s AND notif_from_id = %s) OR (notif_to_id = %s AND notif_from_id = %s))
              AND notif_type_id = (SELECT id FROM glow.glow.notifications_notificationtype WHERE type = 'friend_request' LIMIT 1)
        """
        cursor.execute(delete_notif_query, (friend_id, user_id, user_id, friend_id))

        connection.commit()
        return {
            "status": "success",
            "message": "Friend request canceled or removed.",
        }

    except Exception as error:
        print(f"Error canceling friend request: {error}")
        return {
            "status": "error",
            "message": "An error occurred while canceling the friend request.",
        }

    finally:
        if cursor:
            cursor.close()


def acceptFriend(friend_id, user_id):
    try:
        connection = connections["default"]
        cursor = connection.cursor()

        update_query = """
            UPDATE glow.glow.friends_friend 
            SET status = 'Friends'
            WHERE friend_id = %s AND user_id = %s AND status = 'Pending'
        """
        cursor.execute(update_query, (user_id, friend_id))
        accepted = cursor.rowcount > 0

        if accepted:
            now = datetime.now(pytz.utc)
            cursor.execute(
                "UPDATE glow.glow.friends_friend SET date_became_friends = %s "
                "WHERE friend_id = %s AND user_id = %s",
                (now, user_id, friend_id),
            )
            # The request is answered: it no longer needs attention.
            cursor.execute(
                """
                UPDATE glow.glow.notifications_notification SET status = 'Read'
                WHERE notif_to_id = %s AND notif_from_id = %s AND status = 'Unread'
                  AND notif_type_id = (SELECT id FROM glow.glow.notifications_notificationtype
                                       WHERE type = 'friend_request' LIMIT 1)
                """,
                (user_id, friend_id),
            )
            # Tell the person who sent the request.
            cursor.execute(
                "INSERT INTO glow.glow.notifications_notificationtype (type) "
                "SELECT 'friend_accepted' WHERE NOT EXISTS (SELECT 1 FROM "
                "glow.glow.notifications_notificationtype WHERE type = 'friend_accepted')"
            )
            cursor.execute(
                """
                INSERT INTO glow.glow.notifications_notification
                    (status, notif_type_id, notif_to_id, notif_from_id, content, created_at)
                SELECT 'Unread', id, %s, %s, %s, %s
                FROM glow.glow.notifications_notificationtype WHERE type = 'friend_accepted'
                """,
                (friend_id, user_id,
                 f"{_display_name(cursor, user_id)} accepted your friend request", now),
            )

        connection.commit()
        return {
            "status": "success" if accepted else "error",
            "message": "Friend request accepted." if accepted else "No pending request.",
        }

    except Exception as error:
        print(f"Error accepting friend request: {error}")
        return {
            "status": "error",
            "message": "An error occurred while accepting the friend request.",
        }

    finally:
        if cursor:
            cursor.close()

def unfriend(friend_id, user_id):
    try:
        connection = connections["default"]
        cursor = connection.cursor()

        delete_query = """
            DELETE FROM glow.glow.friends_friend
            WHERE (friend_id = %s AND user_id = %s) OR (friend_id = %s AND user_id = %s)
        """
        cursor.execute(delete_query, (friend_id, user_id, user_id, friend_id))
        cursor.execute(
            """
            DELETE FROM glow.glow.friends_closefriend
            WHERE (owner_id = %s AND friend_id = %s) OR (owner_id = %s AND friend_id = %s)
            """,
            (friend_id, user_id, user_id, friend_id),
        )
        cursor.execute(
            """
            DELETE FROM glow.glow.notifications_notification
            WHERE ((notif_to_id = %s AND notif_from_id = %s) OR (notif_to_id = %s AND notif_from_id = %s))
              AND notif_type_id = (SELECT id FROM glow.glow.notifications_notificationtype WHERE type = 'friend_request' LIMIT 1)
            """,
            (friend_id, user_id, user_id, friend_id),
        )

        connection.commit()
        return {
            "status": "success",
            "message": "You are no longer friends.",
        }

    except Exception as error:
        print(f"Error unfriending: {error}")
        return {
            "status": "error",
            "message": "An error occurred while unfriending.",
        }

    finally:
        if cursor:
            cursor.close()

def checkUserFriendRequest(friend_id, accId):
    try:
        #Dheck if there is any friend request between two users
        # It checks both directions:
        # (1) If user A sent a request to user B
        # (2) If user B sent a request to user A
        query = """
            SELECT * FROM glow.glow.friends_friend 
            WHERE (friend_id = %s AND user_id = %s)
               OR (friend_id = %s AND user_id = %s)
        """
        connection = connections["default"]
        cursor = connection.cursor()
        cursor.execute(query, (friend_id, accId, accId, friend_id))
        row = cursor.fetchone()

        if row is None:
            return None 
        
        result = {
            cursor.description[i][0]: value if value is not None else ""
            for i, value in enumerate(row)
        }

        return result

    except Exception as error:
        print(f"Error: {error}")
    finally:
        if cursor:
            cursor.close()


def myFriends(account_id):
    """Friends plus incoming and outgoing pending requests for one account."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT
                CASE WHEN f.user_id = %s THEN f.friend_id ELSE f.user_id END AS id,
                u.username, a.firstname, a.lastname, a.profile_photo,
                f.status,
                CASE WHEN f.user_id = %s THEN 'outgoing' ELSE 'incoming' END AS direction,
                EXISTS (
                    SELECT 1 FROM glow.glow.friends_closefriend c
                    WHERE c.owner_id = %s
                      AND c.friend_id = CASE WHEN f.user_id = %s THEN f.friend_id ELSE f.user_id END
                ) AS is_close,
                f.date_friend_request, f.date_became_friends
            FROM glow.glow.friends_friend f
            JOIN glow.glow.accounts_account a
                ON a.id = CASE WHEN f.user_id = %s THEN f.friend_id ELSE f.user_id END
            JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
            WHERE (f.user_id = %s OR f.friend_id = %s)
              AND f.status IN ('Friends', 'Pending')
            ORDER BY COALESCE(f.date_became_friends, f.date_friend_request) DESC
            """,
            (account_id,) * 7,
        )
        cols = [c[0] for c in cursor.description]
        rows = [dict(zip(cols, r)) for r in cursor.fetchall()]

    out = {"friends": [], "incoming": [], "outgoing": []}
    for r in rows:
        for k in ("firstname", "lastname", "profile_photo"):
            r[k] = r.get(k) or ""
        for k in ("date_friend_request", "date_became_friends"):
            r[k] = r[k].isoformat() if r.get(k) else None
        if r["status"] == "Friends":
            out["friends"].append(r)
        else:
            out[r["direction"]].append(r)
    return out


def peopleYouMayKnow(account_id, limit=5):
    """Friends of your friends, most mutual friends first. Skips you and anyone
    you already have a request or friendship with (either direction). If that
    gives fewer than `limit`, fills up with recently active accounts."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            WITH mine AS (
                SELECT CASE WHEN user_id = %(me)s THEN friend_id ELSE user_id END AS id
                FROM glow.glow.friends_friend
                WHERE status = 'Friends' AND (user_id = %(me)s OR friend_id = %(me)s)
            ),
            known AS (
                SELECT CASE WHEN user_id = %(me)s THEN friend_id ELSE user_id END AS id
                FROM glow.glow.friends_friend
                WHERE user_id = %(me)s OR friend_id = %(me)s
            ),
            fof AS (
                SELECT CASE WHEN f.user_id = m.id THEN f.friend_id ELSE f.user_id END AS id,
                       m.id AS via
                FROM glow.glow.friends_friend f
                JOIN mine m ON f.user_id = m.id OR f.friend_id = m.id
                WHERE f.status = 'Friends'
            )
            SELECT a.id, u.username, a.firstname, a.lastname, a.profile_photo,
                   COUNT(DISTINCT fof.via) AS mutual_count
            FROM fof
            JOIN glow.glow.accounts_account a ON a.id = fof.id
            JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
            WHERE u.is_active
              AND NOT COALESCE(a.is_bot, FALSE)  -- bots aren't people you know
              AND fof.id <> %(me)s
              AND fof.id NOT IN (SELECT id FROM known)
            GROUP BY a.id, u.username, a.firstname, a.lastname, a.profile_photo
            ORDER BY mutual_count DESC, a.id DESC
            LIMIT %(limit)s
            """,
            {"me": account_id, "limit": limit},
        )
        cols = [c[0] for c in cursor.description]
        people = [dict(zip(cols, r)) for r in cursor.fetchall()]

        if len(people) < limit:
            skip = [account_id] + [p["id"] for p in people]
            cursor.execute(
                """
                SELECT a.id, u.username, a.firstname, a.lastname, a.profile_photo,
                       0 AS mutual_count
                FROM glow.glow.accounts_account a
                JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
                LEFT JOIN glow.glow.posts_post p ON p.account_id = a.id
                WHERE u.is_active
                  AND NOT COALESCE(a.is_bot, FALSE)
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
                {"me": account_id, "skip": skip, "n": limit - len(people)},
            )
            cols = [c[0] for c in cursor.description]
            people += [dict(zip(cols, r)) for r in cursor.fetchall()]

    for p in people:
        for k in ("firstname", "lastname", "profile_photo"):
            p[k] = p.get(k) or ""
    return people

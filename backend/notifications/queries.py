
from django.db import connections
from posts.queries import time_ago
from datetime import datetime, date

def countNotifications(account_id):
    try:
        query = f"""
                SELECT COUNT(*) FROM glow.glow.notifications_notification
                WHERE notif_to_id = %s AND status = 'Unread'
                """
        connection = connections['default']
        cursor = connection.cursor()
        cursor.execute(query, (account_id,))
        result = cursor.fetchone()
        return result[0] if result else 0 

    except Exception as error:
        print(f"Error: {error}")
    finally:        
        if cursor:
            cursor.close()



def showNotificationsByUser(account_id, limit=50):
    """Newest first. Only the fields the UI needs (no SELECT * across the
    sender's whole account row)."""
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(
                """
                SELECT n.id, n.status, n.content, n.created_at,
                       n.notif_type_id, t.type AS notif_type,
                       n.notif_from_id, n.notif_to_id,
                       u.username, a.firstname, a.lastname, a.profile_photo,
                       -- for friend requests: is it still pending, accepted, gone?
                       CASE WHEN t.type = 'friend_request' THEN (
                           SELECT f.status FROM glow.glow.friends_friend f
                           WHERE f.user_id = n.notif_from_id AND f.friend_id = n.notif_to_id
                           LIMIT 1
                       ) END AS friend_status
                FROM glow.glow.notifications_notification n
                LEFT JOIN glow.glow.notifications_notificationtype t ON t.id = n.notif_type_id
                LEFT JOIN glow.glow.accounts_account a ON a.id = n.notif_from_id
                LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
                WHERE n.notif_to_id = %s
                  AND NOT (
                      t.type = 'friend_request' AND EXISTS (
                          SELECT 1 FROM glow.glow.notifications_notification newer
                          WHERE newer.notif_to_id = n.notif_to_id
                            AND newer.notif_from_id = n.notif_from_id
                            AND newer.notif_type_id = n.notif_type_id
                            AND newer.id > n.id
                      )
                  )
                ORDER BY n.created_at DESC NULLS LAST, n.id DESC
                LIMIT %s
                """,
                (account_id, limit),
            )
            columns = [col[0] for col in cursor.description]
            results = []
            for row in cursor.fetchall():
                notif = {}
                for col, value in zip(columns, row):
                    if col == "created_at" and isinstance(value, datetime):
                        notif[col] = time_ago(value)
                    elif isinstance(value, (datetime, date)):
                        notif[col] = value.isoformat()
                    else:
                        notif[col] = "" if value is None else value
                results.append(notif)
            return results

    except Exception as error:
        print(f"Error: {error}")
        return []


def markAllRead(account_id):
    with connections['default'].cursor() as cursor:
        cursor.execute(
            """
            UPDATE glow.glow.notifications_notification
            SET status = 'Read'
            WHERE notif_to_id = %s AND status = 'Unread'
            """,
            (account_id,),
        )
        return {"marked": cursor.rowcount}

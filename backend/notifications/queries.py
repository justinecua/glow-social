import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from GlowProject.db import execute, fetch_all, fetch_value
from posts.queries import time_ago

log = logging.getLogger(__name__)


def count_unread(account_id):
    return fetch_value(
        """
        SELECT COUNT(*)
        FROM glow.glow.notifications_notification
        WHERE notif_to_id = %s AND status = 'Unread'
        """,
        (account_id,),
        default=0,
    )


def list_notifications(account_id, limit=50):  # newest first, with the sender's name and photo
    notifications = fetch_all(
        """
        SELECT n.id, n.status, n.content, n.created_at,
               n.notif_type_id, t.type AS notif_type,
               n.notif_from_id, n.notif_to_id,
               u.username, a.firstname, a.lastname, a.profile_photo,
               CASE WHEN t.type = 'friend_request' THEN (
                   SELECT f.status FROM glow.glow.friends_friend f
                   WHERE f.user_id = n.notif_from_id AND f.friend_id = n.notif_to_id
                   LIMIT 1
               ) END AS friend_status  -- is the request still pending, accepted, or gone?
        FROM glow.glow.notifications_notification n
        LEFT JOIN glow.glow.notifications_notificationtype t ON t.id = n.notif_type_id
        LEFT JOIN glow.glow.accounts_account a ON a.id = n.notif_from_id
        LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE n.notif_to_id = %s
          AND NOT (  -- only the newest friend request from each person
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
        blank_nulls=True,
    )
    for notification in notifications:
        if notification["created_at"]:
            notification["created_at"] = time_ago(notification["created_at"])  # "• 5 mins ago"
    return notifications


def mark_all_read(account_id):
    marked = execute(
        """
        UPDATE glow.glow.notifications_notification
        SET status = 'Read'
        WHERE notif_to_id = %s AND status = 'Unread'
        """,
        (account_id,),
    )
    return {"marked": marked}


def create_notification(type_name, to_id, from_id, content):
    execute(  # make sure the type exists
        """
        INSERT INTO glow.glow.notifications_notificationtype (type)
        SELECT %(t)s
        WHERE NOT EXISTS (SELECT 1 FROM glow.glow.notifications_notificationtype WHERE type = %(t)s)
        """,
        {"t": type_name},
    )
    execute(
        """
        INSERT INTO glow.glow.notifications_notification
            (status, notif_type_id, notif_to_id, notif_from_id, content, created_at)
        SELECT 'Unread', id, %(to)s, %(from)s, %(content)s, %(now)s
        FROM glow.glow.notifications_notificationtype
        WHERE type = %(t)s
        LIMIT 1
        """,
        {"t": type_name, "to": to_id, "from": from_id, "content": content, "now": timezone.now()},
    )


def push_notifications(to_id, from_id):  # live-update the badge and list in to_id's open app
    event = {
        "type": "new_notification",
        "from_user_id": from_id,
        "count": count_unread(to_id),
        "notifications": list_notifications(to_id),
    }
    try:
        async_to_sync(get_channel_layer().group_send)(f"user_{to_id}", event)
    except Exception:  # Redis down: the action itself still worked
        log.warning("Realtime notification push failed", exc_info=True)

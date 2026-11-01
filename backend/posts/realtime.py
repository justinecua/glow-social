"""Tell friends' open apps that a new post exists, so the "New posts" pill
updates right away instead of waiting for the next poll.

Only a hint is pushed ({"type": "posts_new"}); the app then asks the normal
count endpoint, which applies visibility rules. Who gets the hint follows
the audience: friends, or just the Close Friends list; nobody for "only me".
Runs in a background thread so a big friend list never slows the request.
"""

import logging
import threading

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import close_old_connections, connections

from .discover import friend_ids

log = logging.getLogger(__name__)


def _recipients(author_id, audience_key):
    if audience_key == "only_me":
        return []
    if audience_key == "close_friends":
        with connections["default"].cursor() as cursor:
            cursor.execute(
                "SELECT friend_id FROM glow.glow.friends_closefriend WHERE owner_id = %s",
                [author_id],
            )
            close = {r[0] for r in cursor.fetchall()}
        return [f for f in friend_ids(author_id) if f in close]
    return friend_ids(author_id)


def _push(author_id, audience_key):
    try:
        layer = get_channel_layer()
        for account_id in _recipients(author_id, audience_key):
            async_to_sync(layer.group_send)(f"user_{account_id}", {"type": "posts_new"})
    except Exception:  # Redis down etc.: the post itself was saved fine
        log.warning("New-post realtime push failed", exc_info=True)
    finally:
        close_old_connections()  # this thread's DB connection


def notify_new_post(author_id, audience_key):
    threading.Thread(target=_push, args=(author_id, audience_key), daemon=True).start()

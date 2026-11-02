import logging
import threading

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import close_old_connections

from friends.queries import friend_ids
from GlowProject.db import fetch_column

log = logging.getLogger(__name__)


def recipients(author_id, audience_key):  # who could see the new post
    if audience_key == "only_me":
        return []
    friends = friend_ids(author_id)
    if audience_key != "close_friends":
        return friends
    close = set(fetch_column(
        "SELECT friend_id FROM glow.glow.friends_closefriend WHERE owner_id = %s",
        (author_id,),
    ))
    return [f for f in friends if f in close]


def push(author_id, audience_key):  # only a hint; the app then asks the count endpoint, which checks visibility
    try:
        layer = get_channel_layer()
        for account_id in recipients(author_id, audience_key):
            async_to_sync(layer.group_send)(f"user_{account_id}", {"type": "posts_new"})
    except Exception:  # Redis down: the post itself was saved fine
        log.warning("New-post realtime push failed", exc_info=True)
    finally:
        close_old_connections()  # this thread's own database connection


def notify_new_post(author_id, audience_key):  # in a thread, so a big friend list never slows the request
    threading.Thread(target=push, args=(author_id, audience_key), daemon=True).start()

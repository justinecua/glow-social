from django.core.cache import cache
from rest_framework.exceptions import APIException

from accounts.auth_utils import account_id_for_user
from GlowProject.db import fetch_tuples, fetch_value

FRIENDS_WITH_AUTHOR = """EXISTS (
    SELECT 1 FROM glow.glow.friends_friend f
    WHERE f.status = 'Friends'
      AND ((f.user_id = %s AND f.friend_id = {a}.account_id)
        OR (f.friend_id = %s AND f.user_id = {a}.account_id))
)"""


def audience_ids():  # {key: id}, cached briefly (the table is tiny and rarely changes)
    ids = cache.get("audience_ids:v1")
    if ids is None:
        ids = dict(fetch_tuples("SELECT key, id FROM glow.glow.posts_audience WHERE key IS NOT NULL"))
        cache.set("audience_ids:v1", ids, 300)
    return ids


def audience_id(key):
    return audience_ids().get(key) or audience_ids().get("public")


def visible_sql(viewer_id, alias="p"):  # (sql, params) for a WHERE condition limiting posts to the viewer
    ids = audience_ids()
    public = ids.get("public")
    if not viewer_id:
        return f"({alias}.audience_id IS NULL OR {alias}.audience_id = %s)", [public]

    friends_check = FRIENDS_WITH_AUTHOR.format(a=alias)
    sql = f"""(
        {alias}.audience_id IS NULL  -- older posts have no audience: public
        OR {alias}.audience_id = %s  -- public
        OR {alias}.account_id = %s  -- you wrote it (so "only me" posts are yours alone)
        OR ({alias}.audience_id = %s AND {friends_check})  -- friends: you're friends with the author
        OR ({alias}.audience_id = %s AND {friends_check} AND EXISTS (  -- close friends: friends, and on their list
            SELECT 1 FROM glow.glow.friends_closefriend c
            WHERE c.owner_id = {alias}.account_id AND c.friend_id = %s
        ))
    )"""
    params = [
        public,
        viewer_id,
        ids.get("friends"), viewer_id, viewer_id,
        ids.get("close_friends"), viewer_id, viewer_id, viewer_id,
    ]
    return sql, params


def public_sql(alias="p"):
    return visible_sql(None, alias)


def can_view_post(post_id, viewer_id):
    cond, params = visible_sql(viewer_id)
    found = fetch_value(
        f"SELECT 1 FROM glow.glow.posts_post p WHERE p.id = %s AND {cond}",
        [post_id, *params],
    )
    return found is not None


def viewer_account_id(request):  # the signed-in viewer's account id, or None
    try:
        return account_id_for_user(request.user)
    except APIException:  # a bad or expired cookie just means "signed out" here
        return None

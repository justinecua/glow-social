"""Who can see which post. One rule, used everywhere a post is read.

A viewer can see a post if any of these is true:
  - it's public (or has no audience set: older posts)
  - they wrote it
  - it's for "friends" and they're friends with the author
  - it's for "close_friends", they're friends with the author, and the
    author put them on their Close Friends list
"Only me" posts are therefore visible to the author alone.
"""

from django.core.cache import cache
from django.db import connections

FRIENDS_WITH_AUTHOR = """EXISTS (
    SELECT 1 FROM glow.glow.friends_friend f
    WHERE f.status = 'Friends'
      AND ((f.user_id = %s AND f.friend_id = {a}.account_id)
        OR (f.friend_id = %s AND f.user_id = {a}.account_id))
)"""


def audience_ids():
    """{key: id}, cached briefly (the table is tiny and rarely changes)."""
    ids = cache.get("audience_ids:v1")
    if ids is None:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT key, id FROM glow.glow.posts_audience WHERE key IS NOT NULL")
            ids = dict(cursor.fetchall())
        cache.set("audience_ids:v1", ids, 300)
    return ids


def audience_id(key):
    return audience_ids().get(key) or audience_ids().get("public")


def visible_sql(viewer_id, alias="p"):
    """(sql, params) for a WHERE condition limiting posts to the viewer."""
    ids = audience_ids()
    public = ids.get("public")
    if not viewer_id:
        return f"({alias}.audience_id IS NULL OR {alias}.audience_id = %s)", [public]

    friends_check = FRIENDS_WITH_AUTHOR.format(a=alias)
    sql = f"""(
        {alias}.audience_id IS NULL
        OR {alias}.audience_id = %s
        OR {alias}.account_id = %s
        OR ({alias}.audience_id = %s AND {friends_check})
        OR ({alias}.audience_id = %s AND {friends_check} AND EXISTS (
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
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"SELECT 1 FROM glow.glow.posts_post p WHERE p.id = %s AND {cond}",
            [post_id, *params],
        )
        return cursor.fetchone() is not None


def viewer_account_id(request):
    """Signed-in viewer's account id, or None (never raises)."""
    from accounts.auth_utils import account_id_for_user

    try:
        return account_id_for_user(request.user)
    except Exception:
        return None

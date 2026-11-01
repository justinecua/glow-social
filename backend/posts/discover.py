"""Explore & search, built only from Glow's own content (no external APIs,
so no rate limits, costs, or third-party content to moderate)."""

from datetime import datetime, timedelta

import pytz
from django.core.cache import cache
from django.db import connections

from .queries import time_ago
from .visibility import audience_ids, visible_sql

EXPLORE_CACHE_SECONDS = 120

# Same shape as the main feed so the frontend can reuse its post components.
POST_SELECT = """
    SELECT
        p.id,
        p.account_id,
        p.caption,
        p."dateTime",
        u.username,
        a.firstname,
        a.lastname,
        a.profile_photo,
        COUNT(DISTINCT glows.id) AS glow_count,
        COUNT(DISTINCT comments.id) AS comment_count,
        ARRAY_AGG(DISTINCT ph.link) AS photos,
        ARRAY_AGG(DISTINCT glows.account_id) AS glowers,
        COALESCE(aud.key, 'public') AS audience
    FROM glow.glow.posts_post AS p
    LEFT JOIN glow.glow.posts_audience AS aud ON aud.id = p.audience_id
    LEFT JOIN glow.glow.accounts_account AS a ON p.account_id = a.id
    LEFT JOIN glow.glow.auth_user AS u ON a.auth_user_id = u.id
    LEFT JOIN glow.glow.posts_photo AS ph ON p.id = ph.post_id
    LEFT JOIN glow.glow.interactions_glow AS glows ON p.id = glows.post_id
    LEFT JOIN glow.glow.interactions_comment AS comments ON p.id = comments.post_id
"""
POST_GROUP = """
    GROUP BY p.id, p.account_id, p.caption, p."dateTime",
             u.username, a.firstname, a.lastname, a.profile_photo, aud.key
"""


def _rows(cursor):
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def _clean_posts(rows, request):
    for post in rows:
        if isinstance(post.get("dateTime"), datetime):
            post["dateTime"] = time_ago(post["dateTime"])
        post["photos"] = [
            request.build_absolute_uri(p) if request else p
            for p in (post.get("photos") or [])
            if isinstance(p, str) and p.strip()
        ]
        post["glowers"] = [g for g in (post.get("glowers") or []) if g is not None]
        for k in ("caption", "firstname", "lastname", "profile_photo", "username"):
            post[k] = post.get(k) or ""
    return rows


def _posts(where="", params=(), order='p."dateTime" DESC', limit=12, having="",
           request=None, viewer_id=None):
    """Posts matching `where`, limited to what `viewer_id` may see. With no
    viewer (Explore, search, share previews) only public posts are returned."""
    vis, vis_params = visible_sql(viewer_id)
    where = f"{where} AND {vis}" if where else f"WHERE {vis}"
    sql = f"{POST_SELECT} {where} {POST_GROUP} {having} ORDER BY {order} LIMIT %s"
    with connections["default"].cursor() as cursor:
        cursor.execute(sql, (*params, *vis_params, limit))
        return _clean_posts(_rows(cursor), request)


def _trending(request, days=30, limit=12):
    """Most engaged posts recently (glows count double), newest first on ties.
    Falls back to all-time if the last `days` are quiet."""
    order = 'COUNT(DISTINCT glows.id) * 2 + COUNT(DISTINCT comments.id) DESC, p."dateTime" DESC'
    since = datetime.now(pytz.utc) - timedelta(days=days)
    posts = _posts('WHERE p."dateTime" >= %s', (since,), order=order, limit=limit, request=request)
    if len(posts) < 6:
        posts = _posts(order=order, limit=limit, request=request)
    return posts


def _photos(request, limit=18):
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT ph.link, ph.post_id
            FROM glow.glow.posts_photo ph
            JOIN glow.glow.posts_post p ON p.id = ph.post_id
            WHERE ph.link <> '' AND (p.audience_id IS NULL OR p.audience_id = %s)
            ORDER BY p."dateTime" DESC, ph.id DESC
            LIMIT %s
            """,
            (audience_ids().get("public"), limit),
        )
        return [
            {"url": request.build_absolute_uri(link) if request else link, "post_id": post_id}
            for link, post_id in cursor.fetchall()
        ]


def _tags(limit=8):
    """Popular tags. Only clean, single-word tags count (old posts saved
    whole sentences like "atschool #SMC #finalproj" as one tag), and case
    variants are merged ("Family" + "family")."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            r"""
            SELECT MIN(t.tag) AS tag, COUNT(DISTINCT tp.post_id) AS posts
            FROM glow.glow.posts_tag t
            JOIN glow.glow.posts_tag_post tp ON tp.tag_id = t.id
            JOIN glow.glow.posts_post p ON p.id = tp.post_id
            WHERE t.tag ~ '^[A-Za-z0-9_]{2,30}$'
              AND (p.audience_id IS NULL OR p.audience_id = %s)
            GROUP BY LOWER(t.tag)
            ORDER BY posts DESC, LOWER(t.tag)
            LIMIT %s
            """,
            (audience_ids().get("public"), limit),
        )
        return [{"tag": tag, "posts": n} for tag, n in cursor.fetchall()]


def _active_people(limit=8, days=60):
    """People who've posted most recently/often: good accounts to discover."""
    since = datetime.now(pytz.utc) - timedelta(days=days)
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT a.id, u.username, a.firstname, a.lastname, a.profile_photo,
                   COUNT(p.id) FILTER (WHERE p."dateTime" >= %s) AS recent_posts,
                   COUNT(p.id) AS total_posts,
                   MAX(p."dateTime") AS last_post
            FROM glow.glow.accounts_account a
            JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
            JOIN glow.glow.posts_post p ON p.account_id = a.id
            WHERE u.is_active
            GROUP BY a.id, u.username, a.firstname, a.lastname, a.profile_photo
            ORDER BY recent_posts DESC, total_posts DESC, last_post DESC
            LIMIT %s
            """,
            (since, limit),
        )
        people = _rows(cursor)
    for p in people:
        p.pop("last_post", None)
        for k in ("firstname", "lastname", "profile_photo"):
            p[k] = p.get(k) or ""
    return people


def explore(request):
    key = f"explore:v3:{request.get_host()}"
    data = cache.get(key)
    if data is None:
        data = {
            "trending": _trending(request),
            "photos": _photos(request),
            "tags": _tags(),
            "people": _active_people(),
        }
        cache.set(key, data, EXPLORE_CACHE_SECONDS)
    return data


def posts_by_tag(tag, request, limit=30):
    where = """
        WHERE p.id IN (
            SELECT tp.post_id FROM glow.glow.posts_tag_post tp
            JOIN glow.glow.posts_tag t ON t.id = tp.tag_id
            WHERE LOWER(t.tag) = LOWER(%s)
        )
    """
    return _posts(where, (tag,), limit=limit, request=request)


def search(q, request, limit=20):
    """People by username/name, and posts by caption. Case-insensitive."""
    q = (q or "").strip()[:50]
    if len(q) < 2:
        return {"people": [], "posts": []}
    like = f"%{q.replace('%', r'\%').replace('_', r'\_')}%"
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT a.id, u.username, a.firstname, a.lastname, a.profile_photo
            FROM glow.glow.accounts_account a
            JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
            WHERE u.is_active AND (
                u.username ILIKE %s OR a.firstname ILIKE %s OR a.lastname ILIKE %s
                OR (a.firstname || ' ' || a.lastname) ILIKE %s
            )
            ORDER BY (LOWER(u.username) = LOWER(%s)) DESC,
                     (u.username ILIKE %s) DESC,
                     u.username
            LIMIT %s
            """,
            (like, like, like, like, q, f"{q}%", limit),
        )
        people = _rows(cursor)
    for p in people:
        for k in ("firstname", "lastname", "profile_photo"):
            p[k] = p.get(k) or ""
    posts = _posts("WHERE p.caption ILIKE %s", (like,), limit=limit, request=request)
    return {"people": people, "posts": posts}


# ---------------------------------------------------------------- feed
FRIEND_WINDOW_DAYS = 14   # friends' posts this recent are pinned to the top
FRESH_WINDOW_DAYS = 7     # anything newer than this counts as "new"


def friend_ids(account_id):
    if not account_id:
        return []
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT CASE WHEN user_id = %s THEN friend_id ELSE user_id END
            FROM glow.glow.friends_friend
            WHERE status = 'Friends' AND (user_id = %s OR friend_id = %s)
            """,
            (account_id, account_id, account_id),
        )
        return [r[0] for r in cursor.fetchall()]


def feed(request, viewer_id=None, offset=0, limit=7):
    """Home feed: recent posts from you and your friends first, then other
    new posts, then everything older. Each post carries `is_fresh` so the
    client can show a "You're all caught up" divider before older posts."""
    now = datetime.now(pytz.utc)
    circle = friend_ids(viewer_id) + ([viewer_id] if viewer_id else [])
    friend_since = now - timedelta(days=FRIEND_WINDOW_DAYS)
    fresh_since = now - timedelta(days=FRESH_WINDOW_DAYS)

    select = POST_SELECT.replace(
        "SELECT",
        """SELECT
        (p.account_id = ANY(%s) AND p."dateTime" >= %s) AS from_friends,
        ((p.account_id = ANY(%s) AND p."dateTime" >= %s) OR p."dateTime" >= %s) AS is_fresh,""",
        1,
    )
    vis, vis_params = visible_sql(viewer_id)
    sql = f"""
        {select} WHERE {vis} {POST_GROUP}
        ORDER BY from_friends DESC, is_fresh DESC, p."dateTime" DESC, p.id DESC
        OFFSET %s LIMIT %s
    """
    with connections["default"].cursor() as cursor:
        cursor.execute(
            sql,
            (circle, friend_since, circle, friend_since, fresh_since,
             *vis_params, offset, limit),
        )
        return {"results": _clean_posts(_rows(cursor), request)}


def single_post(post_id, request, viewer_id=None):
    posts = _posts("WHERE p.id = %s", (post_id,), limit=1, request=request, viewer_id=viewer_id)
    return posts[0] if posts else None


def posts_by_user(account_id, request, viewer_id=None, limit=500):
    """A profile's posts, limited to what the viewer may see."""
    return _posts("WHERE p.account_id = %s", (account_id,), limit=limit,
                  request=request, viewer_id=viewer_id)

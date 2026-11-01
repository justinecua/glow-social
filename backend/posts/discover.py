"""Explore & search, built only from Glow's own content (no external APIs,
so no rate limits, costs, or third-party content to moderate)."""

from datetime import datetime, timedelta

import pytz
from django.core.cache import cache
from django.db import connections

from .polls import attach_polls
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
        COALESCE(a.is_bot, FALSE) AS is_bot,
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
             u.username, a.firstname, a.lastname, a.profile_photo, a.is_bot, aud.key
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
        rows = _rows(cursor)
    return attach_polls(_clean_posts(rows, request), viewer_id)


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


EXPLORE_VERSION_KEY = "explore:version"


def bump_explore():
    """Throw away cached Explore pages. Call after a post is created,
    edited (text or audience) or deleted, so Explore never shows a deleted
    or no-longer-public post."""
    try:
        cache.incr(EXPLORE_VERSION_KEY)
    except ValueError:  # not set yet
        cache.set(EXPLORE_VERSION_KEY, 1, None)


def explore(request):
    version = cache.get(EXPLORE_VERSION_KEY) or 0
    key = f"explore:v3:{version}:{request.get_host()}"
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


# ---------------------------------------------------------------- ranking
# Modelled on how the big feeds rank (Facebook EdgeRank / Instagram /
# X "For you", Hacker News & Reddit "hot"):
#   score = freshness                     newer is better, halves every 36h
#         + velocity                      engagement relative to age ("hot")
#         + evergreen                     total engagement, so great posts resurface
#         + relationship                  friends, and authors you interact with
#         - seen                          already on your screen before this visit
#         - automated                     bots below real people
#         + shuffle                       per-visit randomness
# Each visit (seed + anchor) has a fixed order, so paging never repeats.
FRESH_WEIGHT = 2.0
FRESH_HALF_LIFE_H = 36
VELOCITY_WEIGHT = 1.2       # x ln(1+E) / (1 + age_h/24)^0.8
EVERGREEN_WEIGHT = 0.35     # x ln(1+E),   E = glows + 2*comments
FRIEND_RECENT_BOOST = 1.5   # you/friends, posted in the last FRIEND_WINDOW_DAYS
FRIEND_ANY_BOOST = 0.4      # you/friends, any age
AFFINITY_WEIGHT = 0.6       # x ln(1 + your glows/comments on this author, 90d)
SEEN_PENALTY = 3.5          # already seen before this visit
BOT_PENALTY = 1.0
SHUFFLE_WEIGHT = 2.0


def feed(request, viewer_id=None, offset=0, limit=7, seed=None, anchor=None):
    """Home feed, ranked like the big social apps (see weights above).

    `seed` changes on each visit, giving a new mix; within a visit it is
    fixed. `anchor` freezes "now" for the visit: newer posts are left out
    (the "New posts" pill announces them) and ages are measured from it."""
    now = datetime.now(pytz.utc)
    anchor = min(anchor or now, now)
    seed = str(seed or "0")[:32]
    circle = friend_ids(viewer_id) + ([viewer_id] if viewer_id else [])

    select = POST_SELECT.replace(
        "SELECT",
        """SELECT
        (p.account_id = ANY(%(circle)s) AND p."dateTime" >= %(friend_since)s) AS from_friends,
        ((p.account_id = ANY(%(circle)s) AND p."dateTime" >= %(friend_since)s)
            OR p."dateTime" >= %(fresh_since)s) AS is_fresh,
        p.account_id = ANY(%(circle)s) AS in_circle,""",
        1,
    )
    vis, vis_params = visible_sql(viewer_id)
    for i in range(len(vis_params)):  # positional %s -> named params
        vis = vis.replace("%s", f"%(vis{i})s", 1)
    params = {
        "viewer": viewer_id or -1,
        "circle": circle,
        "friend_since": anchor - timedelta(days=FRIEND_WINDOW_DAYS),
        "fresh_since": anchor - timedelta(days=FRESH_WINDOW_DAYS),
        "affinity_since": anchor - timedelta(days=90),
        "anchor": anchor,
        "seed": seed,
        "offset": offset,
        "limit": limit,
        **{f"vis{i}": v for i, v in enumerate(vis_params)},
    }
    age_h = 'GREATEST(0, EXTRACT(EPOCH FROM (%(anchor)s - f."dateTime")) / 3600.0)'
    engagement = "LN(1 + f.glow_count + 2 * f.comment_count)"
    sql = f"""
        WITH affinity AS (
            SELECT po.account_id AS author, COUNT(*) AS n
            FROM (
                SELECT post_id FROM glow.glow.interactions_glow
                WHERE account_id = %(viewer)s AND timestamp >= %(affinity_since)s
                UNION ALL
                SELECT post_id FROM glow.glow.interactions_comment
                WHERE account_id = %(viewer)s AND "dateTime" >= %(affinity_since)s
            ) x
            JOIN glow.glow.posts_post po ON po.id = x.post_id
            WHERE po.account_id <> %(viewer)s
            GROUP BY po.account_id
        )
        SELECT f.* FROM (
            {select}
            WHERE {vis} AND p."dateTime" <= %(anchor)s
            {POST_GROUP}
        ) f
        LEFT JOIN affinity af ON af.author = f.account_id
        LEFT JOIN glow.glow.posts_postseen seen
               ON seen.post_id = f.id AND seen.account_id = %(viewer)s
        ORDER BY (
              {FRESH_WEIGHT} * POWER(0.5, {age_h} / {FRESH_HALF_LIFE_H})
            + {VELOCITY_WEIGHT} * {engagement} / POWER(1 + {age_h} / 24.0, 0.8)
            + {EVERGREEN_WEIGHT} * {engagement}
            + CASE WHEN f.from_friends THEN {FRIEND_RECENT_BOOST}
                   WHEN f.in_circle THEN {FRIEND_ANY_BOOST} ELSE 0 END
            + {AFFINITY_WEIGHT} * LN(1 + COALESCE(af.n, 0))
            - CASE WHEN seen.first_seen < %(anchor)s THEN {SEEN_PENALTY} ELSE 0 END
            - CASE WHEN f.is_bot THEN {BOT_PENALTY} ELSE 0 END
            + {SHUFFLE_WEIGHT} * (('x' || SUBSTR(MD5(f.id::text || ':' || %(seed)s), 1, 8))::bit(32)::bigint / 4294967295.0)
        ) DESC, f.id DESC
        OFFSET %(offset)s LIMIT %(limit)s
    """
    with connections["default"].cursor() as cursor:
        cursor.execute(sql, params)
        rows = _rows(cursor)
    for r in rows:
        r.pop("in_circle", None)
    return {"results": attach_polls(_spread_authors(_clean_posts(rows, request)), viewer_id)}


def mark_seen(viewer_id, post_ids):
    """Record that these posts were on the viewer's screen."""
    from django.db.models import F
    from django.utils import timezone

    from .models import Post, PostSeen

    ids = {int(i) for i in post_ids if str(i).isdigit()}
    ids = set(Post.objects.filter(id__in=ids).values_list("id", flat=True))
    if not viewer_id or not ids:
        return 0
    existing = set(
        PostSeen.objects.filter(account_id=viewer_id, post_id__in=ids).values_list("post_id", flat=True)
    )
    if existing:
        PostSeen.objects.filter(account_id=viewer_id, post_id__in=existing).update(
            views=F("views") + 1, last_seen=timezone.now()
        )
    PostSeen.objects.bulk_create(
        [PostSeen(account_id=viewer_id, post_id=i) for i in ids - existing],
        ignore_conflicts=True,
    )
    return len(ids)


def _spread_authors(posts):
    """Avoid the same person (or two bots) twice in a row within a page."""
    out, rest = [], list(posts)
    while rest:
        key = lambda p: "bot" if p.get("is_bot") else p["account_id"]
        last = key(out[-1]) if out else None
        i = next((k for k, p in enumerate(rest) if key(p) != last), 0)
        out.append(rest.pop(i))
    return out


def new_posts_since(viewer_id, since, limit_authors=3):
    """How many posts the viewer could see that were shared after `since`
    (not counting their own), plus a few of their authors for the pill."""
    vis, vis_params = visible_sql(viewer_id)
    own = "AND p.account_id <> %s" if viewer_id else ""
    params = [*vis_params, since] + ([viewer_id] if viewer_id else [])
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"""
            SELECT p.account_id, MAX(p."dateTime") AS latest, COUNT(*) AS n
            FROM glow.glow.posts_post p
            WHERE {vis} AND p."dateTime" > %s {own}
            GROUP BY p.account_id
            ORDER BY latest DESC
            """,
            params,
        )
        by_author = cursor.fetchall()
        count = sum(r[2] for r in by_author)
        author_ids = [r[0] for r in by_author[:limit_authors]]
        authors = []
        if author_ids:
            cursor.execute(
                """
                SELECT a.id, u.username, a.profile_photo
                FROM glow.glow.accounts_account a
                JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
                WHERE a.id = ANY(%s)
                """,
                (author_ids,),
            )
            found = {r[0]: r for r in cursor.fetchall()}
            authors = [
                {"id": i, "username": found[i][1], "profile_photo": found[i][2] or ""}
                for i in author_ids if i in found
            ]
    return {"count": count, "authors": authors}


def single_post(post_id, request, viewer_id=None):
    posts = _posts("WHERE p.id = %s", (post_id,), limit=1, request=request, viewer_id=viewer_id)
    return posts[0] if posts else None


def posts_by_user(account_id, request, viewer_id=None, limit=500):
    """A profile's posts, limited to what the viewer may see."""
    return _posts("WHERE p.account_id = %s", (account_id,), limit=limit,
                  request=request, viewer_id=viewer_id)

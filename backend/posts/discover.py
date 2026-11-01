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
#
# One row per post, no fan-out: counts come from the trigger-maintained
# columns, photos from a correlated subquery, and "did I glow this" from a
# lookup on the (account, post) unique index. The old version joined photos x
# glows x comments and GROUP BY'd them back down, which multiplied rows per
# post (4 photos x 200 glows x 50 comments = 40,000 rows for one post).
def post_select(viewer):
    """SELECT ... FROM for posts. `viewer` is the SQL placeholder for the
    viewer's account id (e.g. "%s" or "%(viewer)s"); NULL means anonymous.
    `glowers` is [viewer] if they glowed it, else [] (the frontend only
    checks whether it contains you; the full list is no longer sent)."""
    return f"""
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
        p.glow_count,
        p.comment_count,
        ARRAY(
            SELECT ph.link FROM glow.glow.posts_photo ph
            WHERE ph.post_id = p.id ORDER BY ph.id
        ) AS photos,
        ARRAY(
            SELECT g.account_id FROM glow.glow.interactions_glow g
            WHERE g.post_id = p.id AND g.account_id = {viewer}
        ) AS glowers,
        COALESCE(aud.key, 'public') AS audience
    FROM glow.glow.posts_post AS p
    LEFT JOIN glow.glow.posts_audience AS aud ON aud.id = p.audience_id
    LEFT JOIN glow.glow.accounts_account AS a ON p.account_id = a.id
    LEFT JOIN glow.glow.auth_user AS u ON a.auth_user_id = u.id
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


def _posts(where="", params=(), order='p."dateTime" DESC', limit=12,
           request=None, viewer_id=None):
    """Posts matching `where`, limited to what `viewer_id` may see. With no
    viewer (Explore, search, share previews) only public posts are returned."""
    vis, vis_params = visible_sql(viewer_id)
    where = f"{where} AND {vis}" if where else f"WHERE {vis}"
    sql = f"{post_select('%s')} {where} ORDER BY {order} LIMIT %s"
    with connections["default"].cursor() as cursor:
        cursor.execute(sql, (viewer_id, *params, *vis_params, limit))
        rows = _rows(cursor)
    return attach_polls(_clean_posts(rows, request), viewer_id)


def _trending(request, days=30, limit=12):
    """Most engaged posts recently (glows count double), newest first on ties.
    Falls back to all-time if the last `days` are quiet."""
    order = 'p.glow_count * 2 + p.comment_count DESC, p."dateTime" DESC'
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
    """People who've posted most in the last `days`: good accounts to
    discover. Only recent posts are aggregated (post_datetime_idx range
    scan), so the cost tracks recent activity, not all-time post volume."""
    since = datetime.now(pytz.utc) - timedelta(days=days)
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT a.id, u.username, a.firstname, a.lastname, a.profile_photo,
                   r.recent_posts
            FROM (
                SELECT account_id, COUNT(*) AS recent_posts, MAX("dateTime") AS last_post
                FROM glow.glow.posts_post
                WHERE "dateTime" >= %s
                GROUP BY account_id
            ) r
            JOIN glow.glow.accounts_account a ON a.id = r.account_id
            JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
            WHERE u.is_active
            ORDER BY r.recent_posts DESC, r.last_post DESC
            LIMIT %s
            """,
            (since, limit),
        )
        people = _rows(cursor)
    for p in people:
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


# Candidates: only these posts are scored, so a feed page costs about the
# same with 1k posts or 10M. Each set is small and index-friendly:
CIRCLE_CANDIDATE_DAYS = 60   # you/friends' posts this recent (all of them)
HOT_DAYS = 3                 # + the HOT_POOL most-engaged posts this recent
HOT_POOL = 400
NEWEST_POOL = 200            # + the newest posts from anyone
EVERGREEN_POOL = 200         # + the most-engaged posts of all time (cached)
MAX_RANKED = 1000            # ranked list per visit is capped here
RANK_CACHE_SECONDS = 10 * 60
EVERGREEN_CACHE_SECONDS = 10 * 60


def _evergreen_ids():
    """Most engaged posts ever. Cached; shared by every viewer (visibility
    is still checked per viewer when ranking)."""
    ids = cache.get("feed:evergreen:v1")
    if ids is None:
        with connections["default"].cursor() as cursor:
            cursor.execute(
                """
                SELECT id FROM glow.glow.posts_post
                ORDER BY glow_count + 2 * comment_count DESC, id DESC
                LIMIT %s
                """,
                (EVERGREEN_POOL,),
            )
            ids = [r[0] for r in cursor.fetchall()]
        cache.set("feed:evergreen:v1", ids, EVERGREEN_CACHE_SECONDS)
    return ids


def _ranked_ids(viewer_id, seed, anchor):
    """Step 1: score candidate posts on cheap columns only and return their
    ids, best first. Cached per visit (viewer + seed + anchor), so scrolling
    pages through a fixed list instead of re-ranking each time."""
    key = f"feed:rank:v1:{viewer_id or 0}:{seed}:{int(anchor.timestamp())}"
    ids = cache.get(key)
    if ids is not None:
        return ids

    circle = friend_ids(viewer_id) + ([viewer_id] if viewer_id else [])
    vis, vis_params = visible_sql(viewer_id)
    for i in range(len(vis_params)):  # positional %s -> named params
        vis = vis.replace("%s", f"%(vis{i})s", 1)
    params = {
        "viewer": viewer_id or -1,
        "circle": circle,
        "friend_since": anchor - timedelta(days=FRIEND_WINDOW_DAYS),
        "circle_since": anchor - timedelta(days=CIRCLE_CANDIDATE_DAYS),
        "hot_since": anchor - timedelta(days=HOT_DAYS),
        "hot_pool": HOT_POOL,
        "newest_pool": NEWEST_POOL,
        "evergreen": _evergreen_ids(),
        "affinity_since": anchor - timedelta(days=90),
        "anchor": anchor,
        "seed": seed,
        "max": MAX_RANKED,
        **{f"vis{i}": v for i, v in enumerate(vis_params)},
    }
    age_h = 'GREATEST(0, EXTRACT(EPOCH FROM (%(anchor)s - p."dateTime")) / 3600.0)'
    engagement = "LN(1 + p.glow_count + 2 * p.comment_count)"
    sql = f"""
        WITH candidates AS (
            SELECT id FROM glow.glow.posts_post
            WHERE account_id = ANY(%(circle)s)
              AND "dateTime" >= %(circle_since)s AND "dateTime" <= %(anchor)s
            UNION
            (SELECT id FROM glow.glow.posts_post
             WHERE "dateTime" >= %(hot_since)s AND "dateTime" <= %(anchor)s
             ORDER BY glow_count + 2 * comment_count DESC
             LIMIT %(hot_pool)s)
            UNION
            (SELECT id FROM glow.glow.posts_post
             WHERE "dateTime" <= %(anchor)s
             ORDER BY "dateTime" DESC
             LIMIT %(newest_pool)s)
            UNION
            SELECT UNNEST(%(evergreen)s::int[])
        ),
        affinity AS (
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
        SELECT p.id
        FROM candidates cand
        JOIN glow.glow.posts_post p ON p.id = cand.id
        LEFT JOIN glow.glow.accounts_account a ON a.id = p.account_id
        LEFT JOIN affinity af ON af.author = p.account_id
        LEFT JOIN glow.glow.posts_postseen seen
               ON seen.post_id = p.id AND seen.account_id = %(viewer)s
        WHERE p."dateTime" <= %(anchor)s
          AND {vis}
        ORDER BY (
              {FRESH_WEIGHT} * POWER(0.5, {age_h} / {FRESH_HALF_LIFE_H})
            + {VELOCITY_WEIGHT} * {engagement} / POWER(1 + {age_h} / 24.0, 0.8)
            + {EVERGREEN_WEIGHT} * {engagement}
            + CASE WHEN p.account_id = ANY(%(circle)s) AND p."dateTime" >= %(friend_since)s
                        THEN {FRIEND_RECENT_BOOST}
                   WHEN p.account_id = ANY(%(circle)s) THEN {FRIEND_ANY_BOOST} ELSE 0 END
            + {AFFINITY_WEIGHT} * LN(1 + COALESCE(af.n, 0))
            - CASE WHEN seen.first_seen < %(anchor)s THEN {SEEN_PENALTY} ELSE 0 END
            - CASE WHEN COALESCE(a.is_bot, FALSE) THEN {BOT_PENALTY} ELSE 0 END
            + {SHUFFLE_WEIGHT} * (('x' || SUBSTR(MD5(p.id::text || ':' || %(seed)s), 1, 8))::bit(32)::bigint / 4294967295.0)
        ) DESC, p.id DESC
        LIMIT %(max)s
    """
    with connections["default"].cursor() as cursor:
        cursor.execute(sql, params)
        ids = [r[0] for r in cursor.fetchall()]
    cache.set(key, ids, RANK_CACHE_SECONDS)
    return ids


def _older_ids(viewer_id, anchor, exclude, offset, limit):
    """After the ranked list runs out: everything else the viewer may see,
    newest first, so scrolling never dead-ends while older posts exist."""
    vis, vis_params = visible_sql(viewer_id)
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"""
            SELECT p.id FROM glow.glow.posts_post p
            WHERE p."dateTime" <= %s AND NOT (p.id = ANY(%s)) AND {vis}
            ORDER BY p."dateTime" DESC, p.id DESC
            OFFSET %s LIMIT %s
            """,
            [anchor, exclude, *vis_params, offset, limit],
        )
        return [r[0] for r in cursor.fetchall()]


def _hydrate(ids, request, viewer_id):
    """Step 2: full rows (author, photos, counts, "did I glow it") for just
    the posts on this page, in the given order."""
    if not ids:
        return []
    # Visibility is checked again here: the ranked list may be up to
    # RANK_CACHE_SECONDS old, and a post could since have been deleted or
    # switched to a narrower audience.
    vis, vis_params = visible_sql(viewer_id)
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"{post_select('%s')} WHERE p.id = ANY(%s) AND {vis}",
            (viewer_id, ids, *vis_params),
        )
        by_id = {r["id"]: r for r in _rows(cursor)}
    return [by_id[i] for i in ids if i in by_id]


def feed(request, viewer_id=None, offset=0, limit=7, seed=None, anchor=None):
    """Home feed, ranked like the big social apps (see weights above).

    `seed` changes on each visit, giving a new mix; within a visit it is
    fixed. `anchor` freezes "now" for the visit: newer posts are left out
    (the "New posts" pill announces them) and ages are measured from it.

    Two steps: rank recent candidates on cheap columns (cached per visit),
    then hydrate only the page being shown. Past the ranked list, older
    posts follow newest-first."""
    now = datetime.now(pytz.utc)
    anchor = min(anchor or now, now)
    seed = str(seed or "0")[:32]

    ranked = _ranked_ids(viewer_id, seed, anchor)
    page = ranked[offset:offset + limit]
    if len(page) < limit:
        older_offset = max(0, offset - len(ranked))
        page += _older_ids(viewer_id, anchor, ranked, older_offset, limit - len(page))

    rows = _hydrate(page, request, viewer_id)
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


PROFILE_PAGE = 12


def _encode_cursor(dt, post_id):
    return f"{dt.isoformat()}|{post_id}"


def _decode_cursor(cursor):
    try:
        when, post_id = str(cursor).rsplit("|", 1)
        return datetime.fromisoformat(when), int(post_id)
    except (ValueError, TypeError):
        return None


def posts_by_user(account_id, request, viewer_id=None, limit=PROFILE_PAGE, before=None):
    """A profile's posts the viewer may see, newest first, `limit` at a time.
    `before` is the `next` cursor from the previous page. Returns
    {"results", "next" (None at the end), "counts"} where counts are the
    real totals for the Posts / Photos / Thoughts tabs."""
    vis, vis_params = visible_sql(viewer_id)
    where, params = 'WHERE p.account_id = %s', [account_id]
    cur = _decode_cursor(before) if before else None
    if cur:
        where += ' AND (p."dateTime", p.id) < (%s, %s)'
        params += list(cur)
    sql = (f'{post_select("%s")} {where} AND {vis} '
           'ORDER BY p."dateTime" DESC NULLS LAST, p.id DESC LIMIT %s')
    with connections["default"].cursor() as cursor:
        cursor.execute(sql, [viewer_id, *params, *vis_params, limit + 1])
        rows = _rows(cursor)
    more = len(rows) > limit
    rows = rows[:limit]
    last = rows[-1] if rows else None
    next_cursor = (_encode_cursor(last["dateTime"], last["id"])
                   if more and last and isinstance(last.get("dateTime"), datetime) else None)
    results = attach_polls(_clean_posts(rows, request), viewer_id)
    return {
        "results": results,
        "next": next_cursor,
        # Totals only on the first page (later pages don't need them).
        "counts": None if before else profile_counts(account_id, viewer_id),
    }


def profile_counts(account_id, viewer_id=None):
    """Posts / photos / text-only posts the viewer may see on this profile."""
    vis, vis_params = visible_sql(viewer_id)
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS posts,
                   COALESCE(SUM(ph.n), 0) AS photos,
                   COUNT(*) FILTER (WHERE COALESCE(ph.n, 0) = 0) AS thoughts
            FROM glow.glow.posts_post p
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS n FROM glow.glow.posts_photo x
                WHERE x.post_id = p.id AND x.link <> ''
            ) ph ON TRUE
            WHERE p.account_id = %s AND {vis}
            """,
            [account_id, *vis_params],
        )
        posts, photos, thoughts = cursor.fetchone()
    return {"posts": posts, "photos": int(photos), "thoughts": thoughts}

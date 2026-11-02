import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from friends.queries import friend_ids
from GlowProject.db import execute, fetch_all, fetch_one, fetch_value
from GlowProject.media import MediaError, delete_media, read_image, save_image

from .models import SPARK_LIFETIME

log = logging.getLogger(__name__)

BACKGROUNDS = {"sunrise", "ocean", "forest", "dusk", "ember", "night"}
MAX_TEXT = 200
CACHE_SECONDS = 120  # each person's Today timeline is cached until something they'd see changes

AUTHOR_JSON = """json_build_object(
    'id', a.id,
    'username', COALESCE(u.username, ''),
    'firstname', COALESCE(a.firstname, ''),
    'lastname', COALESCE(a.lastname, ''),
    'profile_photo', COALESCE(a.profile_photo, '')
)"""

VISIBLE_TO_ME = """
    s.expires_at > now()
    AND (
        s.account_id = %(me)s
        OR (
            EXISTS (  -- the author is my friend
                SELECT 1 FROM glow.glow.friends_friend f
                WHERE f.status = 'Friends'
                  AND ((f.user_id = s.account_id AND f.friend_id = %(me)s)
                    OR (f.friend_id = s.account_id AND f.user_id = %(me)s))
            )
            AND (
                NOT s.close_friends_only
                OR EXISTS (  -- ...and put me on their Close Friends list
                    SELECT 1 FROM glow.glow.friends_closefriend c
                    WHERE c.owner_id = s.account_id AND c.friend_id = %(me)s
                )
            )
        )
    )
"""


class SparkError(ValueError):
    pass


def cache_key(account_id):
    return f"sparks:today:{account_id}"


def forget(account_ids):  # drop cached timelines; never breaks a request
    try:
        cache.delete_many([cache_key(i) for i in set(account_ids)])
    except Exception:  # Redis down
        log.warning("Sparks cache clear failed", exc_info=True)


def push_update(account_ids):  # tell these people's open apps to refetch their sparks
    layer = get_channel_layer()
    for account_id in set(account_ids):
        try:
            async_to_sync(layer.group_send)(f"user_{account_id}", {"type": "sparks_updated"})
        except Exception:  # Redis down: don't retry for every friend
            log.warning("Sparks realtime push failed", exc_info=True)
            return


def tell_friends(author_id):  # a spark was added or removed: refresh everyone who could see it
    audience = set(friend_ids(author_id)) | {author_id}
    forget(audience)
    push_update(audience - {author_id})


def find_visible_spark(spark_id, viewer_id):
    return fetch_one(
        f"SELECT s.id, s.account_id FROM glow.glow.sparks_spark s WHERE s.id = %(id)s AND {VISIBLE_TO_ME}",
        {"id": spark_id, "me": viewer_id},
    )


def find_own_spark(spark_id, viewer_id):
    return fetch_one(
        "SELECT id, account_id, photo FROM glow.glow.sparks_spark WHERE id = %s AND account_id = %s",
        (spark_id, viewer_id),
    )


def today(viewer_id):  # the viewer's Today timeline, from Redis when possible
    try:
        data = cache.get(cache_key(viewer_id))
    except Exception:  # Redis down: use the database
        log.warning("Sparks cache read failed", exc_info=True)
        data = None
    now = timezone.now().isoformat()
    if data is not None and all(s["expires_at"] > now for s in data["sparks"]):  # stale once any spark expired
        return {**data, "now": now}

    data = today_from_db(viewer_id)
    try:
        cache.set(cache_key(viewer_id), data, CACHE_SECONDS)
    except Exception:  # Redis down: still works, just uncached
        log.warning("Sparks cache write failed", exc_info=True)
    return data


def today_from_db(viewer_id):  # oldest first, plus a per-author summary for the avatar rings
    sparks = fetch_all(
        f"""
        SELECT
            s.id, s.account_id, s.photo, s.text, s.background, s.close_friends_only,
            s.created_at, s.expires_at,
            {AUTHOR_JSON} AS author,
            s.account_id = %(me)s AS mine,
            EXISTS (SELECT 1 FROM glow.glow.sparks_sparkview v
                    WHERE v.spark_id = s.id AND v.account_id = %(me)s) AS viewed,
            EXISTS (SELECT 1 FROM glow.glow.sparks_sparkwarm w
                    WHERE w.spark_id = s.id AND w.account_id = %(me)s) AS warmed,
            (SELECT COUNT(*) FROM glow.glow.sparks_sparkview v
             WHERE v.spark_id = s.id AND v.account_id <> s.account_id) AS view_count,
            (SELECT COUNT(*) FROM glow.glow.sparks_sparkwarm w WHERE w.spark_id = s.id) AS warm_count
        FROM glow.glow.sparks_spark s
        JOIN glow.glow.accounts_account a ON a.id = s.account_id
        LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE {VISIBLE_TO_ME}
        ORDER BY s.created_at
        """,
        {"me": viewer_id},
    )

    items, authors = [], {}
    for s in sparks:
        seen = s["mine"] or s["viewed"]
        items.append({
            "id": s["id"],
            "author": s["author"],
            "photo": s["photo"],
            "text": s["text"],
            "background": s["background"],
            "close_friends_only": s["close_friends_only"],
            "created_at": s["created_at"].isoformat(),
            "expires_at": s["expires_at"].isoformat(),
            "seen": seen,
            "warmed": s["warmed"],
            "mine": s["mine"],
            "views": s["view_count"] if s["mine"] else None,  # only the author sees counts
            "warms": s["warm_count"] if s["mine"] else None,
        })
        author = authors.setdefault(s["account_id"], {"latest": None, "unseen": False, "close": False})
        author["latest"] = s["created_at"].isoformat()  # sparks are oldest first
        author["unseen"] = author["unseen"] or not seen
        author["close"] = author["close"] or s["close_friends_only"]
    return {"now": timezone.now().isoformat(), "sparks": items, "authors": authors}


def save_photo(source):  # stored relative (/media/...), works on any domain
    try:
        return save_image(read_image(source), "sparks")
    except MediaError as e:
        raise SparkError(str(e))


def create(viewer_id, data):
    text = str(data.get("text") or "").strip()[:MAX_TEXT]
    photo_in = data.get("photo")
    if not photo_in and not text:
        raise SparkError("Add a photo or write something.")

    background = str(data.get("background") or "")
    if background not in BACKGROUNDS:
        background = "sunrise"
    photo = save_photo(photo_in) if photo_in else ""
    now = timezone.now()

    spark_id = fetch_value(
        """
        INSERT INTO glow.glow.sparks_spark
            (account_id, photo, text, background, close_friends_only, created_at, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            viewer_id,
            photo,
            text,
            "" if photo else background,  # backgrounds are only for text sparks
            str(data.get("close_friends_only")).lower() in ("true", "1"),  # multipart sends "true", JSON sends true
            now,
            now + SPARK_LIFETIME,
        ),
    )
    tell_friends(viewer_id)
    return spark_id


def mark_viewed(spark, viewer_id):
    if spark["account_id"] == viewer_id:
        return
    added = execute(
        """
        INSERT INTO glow.glow.sparks_sparkview (spark_id, account_id, viewed_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (spark_id, account_id) DO NOTHING
        """,
        (spark["id"], viewer_id, timezone.now()),
    )
    if added:
        forget([viewer_id, spark["account_id"]])  # your "seen" state and the author's view count changed


def count_warms(spark_id):
    return fetch_value("SELECT COUNT(*) FROM glow.glow.sparks_sparkwarm WHERE spark_id = %s", (spark_id,))


def warm(spark, viewer_id):  # a quiet reaction
    if spark["account_id"] == viewer_id:
        raise SparkError("You can't warm your own spark.")
    mark_viewed(spark, viewer_id)
    execute(
        """
        INSERT INTO glow.glow.sparks_sparkwarm (spark_id, account_id, created_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (spark_id, account_id) DO NOTHING
        """,
        (spark["id"], viewer_id, timezone.now()),
    )
    forget([viewer_id, spark["account_id"]])
    return count_warms(spark["id"])


def unwarm(spark, viewer_id):
    removed = execute(
        "DELETE FROM glow.glow.sparks_sparkwarm WHERE spark_id = %s AND account_id = %s",
        (spark["id"], viewer_id),
    )
    if removed:
        forget([viewer_id, spark["account_id"]])
    return count_warms(spark["id"])


def stats(spark):  # who viewed and warmed your spark (author only)
    viewers = fetch_all(
        f"""
        SELECT {AUTHOR_JSON} AS person, v.viewed_at,
               EXISTS (SELECT 1 FROM glow.glow.sparks_sparkwarm w
                       WHERE w.spark_id = v.spark_id AND w.account_id = v.account_id) AS warmed
        FROM glow.glow.sparks_sparkview v
        JOIN glow.glow.accounts_account a ON a.id = v.account_id
        LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE v.spark_id = %(spark)s AND v.account_id <> %(author)s
        ORDER BY v.viewed_at DESC
        """,
        {"spark": spark["id"], "author": spark["account_id"]},
    )
    return {
        "views": len(viewers),
        "warms": count_warms(spark["id"]),
        "viewers": [
            {**v["person"], "warmed": v["warmed"], "viewed_at": v["viewed_at"].isoformat()}
            for v in viewers[:100]
        ],
    }


def delete_sparks(spark_ids):  # foreign keys don't cascade, so views and warms go first
    with transaction.atomic():
        execute("DELETE FROM glow.glow.sparks_sparkview WHERE spark_id = ANY(%s)", (spark_ids,))
        execute("DELETE FROM glow.glow.sparks_sparkwarm WHERE spark_id = ANY(%s)", (spark_ids,))
        execute("DELETE FROM glow.glow.sparks_spark WHERE id = ANY(%s)", (spark_ids,))


def remove(spark):
    delete_sparks([spark["id"]])
    delete_media(spark["photo"])
    tell_friends(spark["account_id"])


def purge_expired():  # timelines already hide expired sparks, so nobody needs telling
    expired = fetch_all("SELECT id, photo FROM glow.glow.sparks_spark WHERE expires_at <= now()")
    if expired:
        delete_sparks([s["id"] for s in expired])
        for spark in expired:
            delete_media(spark["photo"])
    return len(expired)

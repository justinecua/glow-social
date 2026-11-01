"""Sparks: 24-hour moments, shown on a "Today" timeline by time of day.

Who sees a spark: its author, and the author's friends (only the author's
Close Friends when `close_friends_only`). Never public."""


from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.db import IntegrityError
from django.db.models import Count
from django.utils import timezone

from accounts.models import Account
from friends.models import CloseFriend
from posts.discover import friend_ids

from GlowProject.media import MediaError, delete_media, read_image, save_image
from .models import Spark, SparkView, SparkWarm

MAX_PHOTO_BYTES = 8 * 1024 * 1024
BACKGROUNDS = {"sunrise", "ocean", "forest", "dusk", "ember", "night"}


class SparkError(ValueError):
    pass


# ---------------------------------------------------------------- Redis cache + realtime
# Each person's Today timeline is cached in Redis. It's cleared only when
# something they'd see changes (a friend posts/deletes, they view/warm), and
# friends are told over the WebSocket to refetch, so apps don't need to poll.
CACHE_SECONDS = 120


def _cache_key(account_id):
    return f"sparks:today:{account_id}"


def _forget(account_ids):
    """Drop cached timelines (one Redis round trip). Never breaks a request."""
    try:
        cache.delete_many([_cache_key(i) for i in set(account_ids)])
    except Exception as error:
        print(f"Sparks cache clear failed: {error}")


def _push_update(account_ids):
    """Tell these people's open apps to refetch their sparks (best effort)."""
    layer = get_channel_layer()
    for account_id in set(account_ids):
        try:
            async_to_sync(layer.group_send)(f"user_{account_id}", {"type": "sparks_updated"})
        except Exception as error:
            print(f"Sparks realtime push failed: {error}")
            return  # Redis is down: don't retry for every friend


def _audience_of(author_id):
    """Everyone whose timeline a new/deleted spark by `author_id` affects."""
    return set(friend_ids(author_id)) | {author_id}


# ---------------------------------------------------------------- photos
def _save_photo(source, request):
    """Validate + store a spark photo (multipart file or legacy data URL)."""
    try:
        link = save_image(read_image(source), "sparks")
    except MediaError as e:
        raise SparkError(str(e))
    return request.build_absolute_uri(link) if request and link.startswith("/") else link


def delete_photo_file(url):
    delete_media(url)


# ---------------------------------------------------------------- visibility
def _audience(viewer_id):
    """(author ids whose normal sparks I can see, author ids who put me on
    their Close Friends list)."""
    friends = set(friend_ids(viewer_id))
    close_of = set(
        CloseFriend.objects.filter(friend_id=viewer_id, owner_id__in=friends).values_list("owner_id", flat=True)
    )
    return friends | {viewer_id}, close_of


def visible_sparks(viewer_id):
    now = timezone.now()
    authors, close_of = _audience(viewer_id)
    qs = Spark.objects.filter(account_id__in=authors, expires_at__gt=now).select_related(
        "account", "account__auth_user"
    )
    return [
        s for s in qs
        if not s.close_friends_only or s.account_id == viewer_id or s.account_id in close_of
    ]


def can_see(spark, viewer_id):
    if spark.expires_at <= timezone.now():
        return False
    if spark.account_id == viewer_id:
        return True
    authors, close_of = _audience(viewer_id)
    if spark.account_id not in authors:
        return False
    return not spark.close_friends_only or spark.account_id in close_of


# ---------------------------------------------------------------- read
def _person(acc: Account):
    return {
        "id": acc.id,
        "username": acc.auth_user.username if acc.auth_user else "",
        "firstname": acc.firstname or "",
        "lastname": acc.lastname or "",
        "profile_photo": acc.profile_photo or "",
    }


def today(viewer_id):
    """The viewer's Today timeline, served from Redis when possible."""
    key = _cache_key(viewer_id)
    try:
        data = cache.get(key)
    except Exception:
        data = None  # Redis down: just use the database
    now = timezone.now().isoformat()
    # A cached copy is only good while none of its sparks have expired.
    if data is not None and all(s["expires_at"] > now for s in data["sparks"]):
        return {**data, "now": now}
    data = _today_from_db(viewer_id)
    try:
        cache.set(key, data, CACHE_SECONDS)
    except Exception:
        pass
    return data


def _today_from_db(viewer_id):
    """Everything on the viewer's Today timeline, oldest first, plus a
    per-author summary used for the glowing avatar rings."""
    sparks = visible_sparks(viewer_id)
    ids = [s.id for s in sparks]
    seen = set(SparkView.objects.filter(account_id=viewer_id, spark_id__in=ids).values_list("spark_id", flat=True))
    warmed = set(SparkWarm.objects.filter(account_id=viewer_id, spark_id__in=ids).values_list("spark_id", flat=True))
    mine = [s.id for s in sparks if s.account_id == viewer_id]
    view_counts = dict(
        SparkView.objects.filter(spark_id__in=mine).exclude(account_id=viewer_id)
        .values("spark_id").annotate(n=Count("id")).values_list("spark_id", "n")
    )
    warm_counts = dict(
        SparkWarm.objects.filter(spark_id__in=mine).values("spark_id").annotate(n=Count("id"))
        .values_list("spark_id", "n")
    )

    items, authors = [], {}
    for s in sparks:
        own = s.account_id == viewer_id
        items.append({
            "id": s.id,
            "author": _person(s.account),
            "photo": s.photo,
            "text": s.text,
            "background": s.background,
            "close_friends_only": s.close_friends_only,
            "created_at": s.created_at.isoformat(),
            "expires_at": s.expires_at.isoformat(),
            "seen": own or s.id in seen,
            "warmed": s.id in warmed,
            "mine": own,
            "views": view_counts.get(s.id, 0) if own else None,
            "warms": warm_counts.get(s.id, 0) if own else None,
        })
        a = authors.setdefault(s.account_id, {"latest": None, "unseen": False, "close": False})
        a["latest"] = s.created_at.isoformat()  # sparks are oldest-first
        a["unseen"] = a["unseen"] or not (own or s.id in seen)
        a["close"] = a["close"] or s.close_friends_only
    return {"now": timezone.now().isoformat(), "sparks": items, "authors": authors}


# ---------------------------------------------------------------- write
def create(viewer_id, data, request=None):
    text = str(data.get("text") or "").strip()[:200]
    background = str(data.get("background") or "")
    photo_in = data.get("photo")
    if not photo_in and not text:
        raise SparkError("Add a photo or write something.")
    if background not in BACKGROUNDS:
        background = "sunrise" if not photo_in else ""
    photo = _save_photo(photo_in, request) if photo_in else ""
    s = Spark.objects.create(
        account_id=viewer_id,
        photo=photo,
        text=text,
        background="" if photo else background,
        # Multipart sends "true"/"false" strings; JSON sends booleans.
        close_friends_only=str(data.get("close_friends_only")).lower() in ("true", "1"),
    )
    audience = _audience_of(viewer_id)
    _forget(audience)
    _push_update(audience - {viewer_id})
    return s


def mark_viewed(spark, viewer_id):
    if spark.account_id == viewer_id:
        return
    try:
        _, created = SparkView.objects.get_or_create(spark=spark, account_id=viewer_id)
    except IntegrityError:
        created = False
    if created:
        # Your "seen" state and the author's view count changed.
        _forget([viewer_id, spark.account_id])


def warm(spark, viewer_id):
    if spark.account_id == viewer_id:
        raise SparkError("You can't warm your own spark.")
    mark_viewed(spark, viewer_id)
    try:
        SparkWarm.objects.get_or_create(spark=spark, account_id=viewer_id)
    except IntegrityError:
        pass
    _forget([viewer_id, spark.account_id])
    return spark.warms.count()


def unwarm(spark, viewer_id):
    """Take back your spark reaction."""
    deleted, _ = SparkWarm.objects.filter(spark=spark, account_id=viewer_id).delete()
    if deleted:
        _forget([viewer_id, spark.account_id])
    return spark.warms.count()


def stats(spark):
    """Who viewed and warmed your spark (author only)."""
    warmers = set(spark.warms.values_list("account_id", flat=True))
    viewers = (
        spark.views.exclude(account_id=spark.account_id)
        .select_related("account", "account__auth_user").order_by("-viewed_at")
    )
    return {
        "views": viewers.count(),
        "warms": len(warmers),
        "viewers": [
            {**_person(v.account), "warmed": v.account_id in warmers, "viewed_at": v.viewed_at.isoformat()}
            for v in viewers[:100]
        ],
    }


def remove(spark, notify=True):
    author_id = spark.account_id
    delete_photo_file(spark.photo)
    spark.delete()
    if notify:
        audience = _audience_of(author_id)
        _forget(audience)
        _push_update(audience - {author_id})


def purge_expired():
    """Delete sparks (and their photo files) that expired."""
    n = 0
    for s in Spark.objects.filter(expires_at__lte=timezone.now()):
        # Timelines already hide expired sparks, so no need to notify anyone.
        remove(s, notify=False)
        n += 1
    return n

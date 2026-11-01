"""Sparks: 24-hour moments, shown on a "Today" timeline by time of day.

Who sees a spark: its author, and the author's friends (only the author's
Close Friends when `close_friends_only`). Never public."""

import base64
import binascii
import os
import uuid

from django.conf import settings
from django.db import IntegrityError
from django.db.models import Count
from django.utils import timezone

from accounts.models import Account
from friends.models import CloseFriend
from posts.discover import friend_ids

from .models import Spark, SparkView, SparkWarm

MAX_PHOTO_BYTES = 8 * 1024 * 1024
BACKGROUNDS = {"sunrise", "ocean", "forest", "dusk", "ember", "night"}


class SparkError(ValueError):
    pass


# ---------------------------------------------------------------- photos
def _image_ext(data: bytes):
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _save_photo(data_url, request):
    if not isinstance(data_url, str) or not data_url.startswith("data:") or "," not in data_url:
        raise SparkError("That photo couldn't be read.")
    try:
        data = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    except (binascii.Error, ValueError):
        raise SparkError("That photo couldn't be read.")
    if len(data) > MAX_PHOTO_BYTES:
        raise SparkError("Photos must be 8 MB or smaller.")
    ext = _image_ext(data)
    if not ext:
        raise SparkError("Use a JPG, PNG, GIF or WebP image.")
    rel = os.path.join("sparks", f"{uuid.uuid4().hex}.{ext}")
    full = os.path.join(settings.MEDIA_ROOT, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as f:
        f.write(data)
    link = settings.MEDIA_URL.rstrip("/") + "/" + rel.replace(os.sep, "/")
    return request.build_absolute_uri(link) if request else link


def delete_photo_file(url):
    marker = settings.MEDIA_URL.rstrip("/") + "/sparks/"
    i = (url or "").find(marker)
    if i == -1:
        return
    rel = url[i + len(settings.MEDIA_URL.rstrip("/")) + 1:]
    path = os.path.normpath(os.path.join(settings.MEDIA_ROOT, rel))
    if path.startswith(os.path.normpath(settings.MEDIA_ROOT)) and os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass


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
        close_friends_only=bool(data.get("close_friends_only")),
    )
    return s


def mark_viewed(spark, viewer_id):
    if spark.account_id == viewer_id:
        return
    try:
        SparkView.objects.get_or_create(spark=spark, account_id=viewer_id)
    except IntegrityError:
        pass


def warm(spark, viewer_id):
    if spark.account_id == viewer_id:
        raise SparkError("You can't warm your own spark.")
    mark_viewed(spark, viewer_id)
    try:
        SparkWarm.objects.get_or_create(spark=spark, account_id=viewer_id)
    except IntegrityError:
        pass
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


def remove(spark):
    delete_photo_file(spark.photo)
    spark.delete()


def purge_expired():
    """Delete sparks (and their photo files) that expired."""
    n = 0
    for s in Spark.objects.filter(expires_at__lte=timezone.now()):
        remove(s)
        n += 1
    return n

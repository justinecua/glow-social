"""User data rights: export everything we hold about a user, and delete it.

Required in some form by GDPR (access / erasure), the Philippine Data Privacy
Act, CCPA, and the Apple/Google app store policies.
"""

import logging

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import Q

from friends.models import Friend
from interactions.models import Comment, Glow, Share
from notifications.models import Notification
from posts.models import Photo, Post

from .models import Account

logger = logging.getLogger(__name__)


def _iso(dt):
    return dt.isoformat() if dt else None


def export_user_data(user):
    account = Account.objects.filter(auth_user=user).first()
    data = {
        "user": {
            "username": user.username,
            "email": user.email,
            "date_joined": _iso(user.date_joined),
            "last_login": _iso(user.last_login),
        },
        "profile": None,
        "posts": [],
        "comments": [],
        "glows": [],
        "shares": [],
        "friends": [],
        "notifications": [],
        "close_friends": [],
        "messages_sent": [],
        "glows_sent": [],
        "glows_received": [],
    }
    if not account:
        return data

    data["profile"] = {
        "firstname": account.firstname,
        "lastname": account.lastname,
        "gender": account.gender,
        "birthday": account.birthday.isoformat() if account.birthday else None,
        "bio": account.bio,
        "profile_photo": account.profile_photo,
        "cover_photo": account.cover_photo,
        "terms_version": account.terms_version,
        "terms_accepted_at": _iso(account.terms_accepted_at),
        "marketing_opt_in": account.marketing_opt_in,
        "marketing_opt_in_at": _iso(account.marketing_opt_in_at),
    }

    for post in Post.objects.filter(account=account).order_by("dateTime"):
        data["posts"].append(
            {
                "id": post.id,
                "caption": post.caption,
                "created_at": _iso(post.dateTime),
                "photos": list(
                    Photo.objects.filter(post=post).values_list("link", flat=True)
                ),
            }
        )

    data["comments"] = [
        {
            "post_id": c.post_id,
            "content": c.content,
            "reply_to_comment_id": c.parent_id,
            "created_at": _iso(c.dateTime),
        }
        for c in Comment.objects.filter(account=account).order_by("dateTime")
    ]
    data["glows"] = [
        {"post_id": g.post_id, "created_at": _iso(g.timestamp)}
        for g in Glow.objects.filter(account=account)
    ]
    data["shares"] = [
        {"post_id": s.post_id, "caption": s.caption, "created_at": _iso(s.timestamp)}
        for s in Share.objects.filter(account=account)
    ]

    for f in Friend.objects.filter(Q(user=account) | Q(friend=account)).select_related(
        "user__auth_user", "friend__auth_user"
    ):
        other = f.friend if f.user_id == account.id else f.user
        data["friends"].append(
            {
                "username": getattr(other.auth_user, "username", None),
                "status": f.status,
                "requested_at": _iso(f.date_friend_request),
                "became_friends_at": _iso(f.date_became_friends),
            }
        )

    from kudos.models import GlowNote
    from friends.models import CloseFriend

    from messaging.models import Message

    data["messages_sent"] = [
        {"conversation_id": m.conversation_id, "body": m.body, "created_at": _iso(m.created_at)}
        for m in Message.objects.filter(sender=account, is_deleted=False).order_by("created_at")
    ]

    data["close_friends"] = list(
        CloseFriend.objects.filter(owner=account)
        .values_list("friend__auth_user__username", flat=True)
    )

    data["glows_sent"] = [
        {"to": getattr(n.recipient.auth_user, "username", None), "message": n.message,
         "created_at": _iso(n.created_at)}
        for n in GlowNote.objects.filter(sender=account).select_related("recipient__auth_user")
    ]
    data["glows_received"] = [
        {"from": getattr(n.sender.auth_user, "username", None), "message": n.message,
         "created_at": _iso(n.created_at)}
        for n in GlowNote.objects.filter(recipient=account).select_related("sender__auth_user")
    ]

    data["notifications"] = [
        {"content": n.content, "status": n.status, "created_at": _iso(n.created_at)}
        for n in Notification.objects.filter(notif_to=account)
    ]
    return data


def _imagekit_file_ids(account):
    ids = list(
        Photo.objects.filter(post__account=account)
        .exclude(link_id_imagekit__isnull=True)
        .exclude(link_id_imagekit="")
        .values_list("link_id_imagekit", flat=True)
    )
    for fid in (account.profile_photo_id_imagekit, account.cover_photo_id_imagekit):
        if fid:
            ids.append(fid)
    return list(dict.fromkeys(ids))


def _delete_imagekit_files(file_ids):
    """Best effort: the account is already gone; log anything left behind."""
    private_key = getattr(settings, "IMAGEKIT_PRIVATE_KEY", None)
    if not file_ids or not private_key:
        if file_ids:
            logger.warning(
                "IMAGEKIT_PRIVATE_KEY not set; %d files not deleted: %s",
                len(file_ids),
                file_ids,
            )
        return
    for i in range(0, len(file_ids), 100):  # API limit: 100 ids per call
        batch = file_ids[i : i + 100]
        try:
            resp = requests.post(
                "https://api.imagekit.io/v1/files/batch/deleteByFileIds",
                json={"fileIds": batch},
                auth=(private_key, ""),
                timeout=15,
            )
            if resp.status_code >= 400:
                logger.warning(
                    "ImageKit delete failed (%s): %s", resp.status_code, resp.text
                )
        except requests.RequestException as e:
            logger.warning("ImageKit delete error: %s; ids=%s", e, batch)


def delete_user_account(user):
    """Permanently delete the user and everything linked to them.

    Deleting auth_user cascades to Account, which cascades to posts, photos,
    comments (and replies to them), glows, shares, friendships and
    notifications.
    """
    account = Account.objects.filter(auth_user=user).first()
    file_ids = _imagekit_file_ids(account) if account else []

    with transaction.atomic():
        if account:
            account.delete()
        user.delete()

    _delete_imagekit_files(file_ids)

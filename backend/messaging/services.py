"""Direct messages and group chats.

Rules:
  - You can only start a chat with (or add to a group) people you're friends with.
  - Only members can read or post in a conversation.
  - A 1:1 chat between two people is unique: starting it again reopens it.
  - Groups hold up to Conversation.MAX_GROUP_MEMBERS people.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone

from accounts.models import Account
from friends.models import Friend

from .models import Conversation, ConversationMember, Message


class ChatError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


# ---------------------------------------------------------------- helpers
def _person(account):
    return {
        "id": account.id,
        "username": getattr(account.auth_user, "username", ""),
        "firstname": account.firstname or "",
        "lastname": account.lastname or "",
        "profile_photo": account.profile_photo or "",
    }


def _friend_ids(account_id):
    rows = Friend.objects.filter(
        Q(user_id=account_id) | Q(friend_id=account_id), status="Friends"
    ).values_list("user_id", "friend_id")
    return {b if a == account_id else a for a, b in rows}


def _membership(conversation_id, account_id):
    m = (
        ConversationMember.objects.select_related("conversation")
        .filter(conversation_id=conversation_id, account_id=account_id)
        .first()
    )
    if not m:
        raise ChatError("Conversation not found.", 404)
    return m


def serialize_message(msg):
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "body": "" if msg.is_deleted else msg.body,
        "is_deleted": msg.is_deleted,
        "edited": msg.edited_at is not None and not msg.is_deleted,
        "created_at": msg.created_at.isoformat(),
    }


def _member_ids(conversation_id):
    return list(
        ConversationMember.objects.filter(conversation_id=conversation_id).values_list(
            "account_id", flat=True
        )
    )


def broadcast(conversation_id, event):
    """Push `event` to every member's personal WebSocket group (best effort)."""
    layer = get_channel_layer()
    for account_id in _member_ids(conversation_id):
        try:
            async_to_sync(layer.group_send)(f"user_{account_id}", event)
        except Exception as error:  # Redis down etc.: HTTP still worked
            print(f"Realtime push failed: {error}")


# ---------------------------------------------------------------- reading
def serialize_conversation(conv, me_id, unread=0, last_message=None, members=None):
    members = members if members is not None else list(
        conv.members.select_related("account__auth_user").all()
    )
    others = [m for m in members if m.account_id != me_id]
    my = next((m for m in members if m.account_id == me_id), None)
    if conv.is_group:
        name = conv.title or ", ".join(
            (o.account.firstname or o.account.auth_user.username) for o in others[:3]
        ) or "Group chat"
    else:
        other = others[0].account if others else None
        name = (
            " ".join(filter(None, [other.firstname, other.lastname])) or other.auth_user.username
            if other else "Deleted user"
        )
    return {
        "id": conv.id,
        "is_group": conv.is_group,
        "title": conv.title,
        "name": name,
        "members": [_person(m.account) for m in members],
        "member_reads": {
            str(m.account_id): m.last_read_at.isoformat() if m.last_read_at else None
            for m in members
        },
        "created_by": conv.created_by_id,
        "updated_at": conv.updated_at.isoformat(),
        "unread": unread,
        "last_message": last_message,
        "my_last_read_at": my.last_read_at.isoformat() if my and my.last_read_at else None,
    }


def list_conversations(me_id, limit=50):
    convs = list(
        Conversation.objects.filter(members__account_id=me_id)
        .order_by("-updated_at")
        .prefetch_related("members__account__auth_user")[:limit]
    )
    ids = [c.id for c in convs]

    last_ids = dict(
        Message.objects.filter(conversation_id__in=ids)
        .values("conversation_id")
        .annotate(last=Max("id"))
        .values_list("conversation_id", "last")
    )
    last_msgs = {m.conversation_id: m for m in Message.objects.filter(id__in=last_ids.values())}

    my_reads = dict(
        ConversationMember.objects.filter(conversation_id__in=ids, account_id=me_id).values_list(
            "conversation_id", "last_read_at"
        )
    )
    unread = {}
    for cid in ids:
        qs = Message.objects.filter(conversation_id=cid, is_deleted=False).exclude(sender_id=me_id)
        if my_reads.get(cid):
            qs = qs.filter(created_at__gt=my_reads[cid])
        unread[cid] = qs.count()

    out = []
    for c in convs:
        lm = last_msgs.get(c.id)
        out.append(
            serialize_conversation(
                c,
                me_id,
                unread=unread.get(c.id, 0),
                last_message=serialize_message(lm) if lm else None,
                members=list(c.members.all()),
            )
        )
    return out


def unread_total(me_id):
    """Number of conversations with unread messages (for the nav badge)."""
    reads = ConversationMember.objects.filter(account_id=me_id).values_list(
        "conversation_id", "last_read_at"
    )
    total = 0
    for cid, last_read in reads:
        qs = Message.objects.filter(conversation_id=cid, is_deleted=False).exclude(sender_id=me_id)
        if last_read:
            qs = qs.filter(created_at__gt=last_read)
        if qs.exists():
            total += 1
    return total


def get_conversation(conversation_id, me_id):
    m = _membership(conversation_id, me_id)
    return serialize_conversation(m.conversation, me_id)


def list_messages(conversation_id, me_id, before=None, limit=30):
    _membership(conversation_id, me_id)
    qs = Message.objects.filter(conversation_id=conversation_id)
    if before:
        qs = qs.filter(id__lt=before)
    page = list(qs.order_by("-id")[: limit + 1])
    has_more = len(page) > limit
    page = page[:limit]
    page.reverse()  # oldest first for display
    return {"results": [serialize_message(m) for m in page], "has_more": has_more}


# ---------------------------------------------------------------- writing
def _find_dm(a_id, b_id):
    """The existing 1:1 chat between two people, if any. (Two separate
    lookups: filtering one queryset on both members joins the table twice
    and makes a member Count unreliable.)"""
    mine = set(
        ConversationMember.objects.filter(account_id=a_id, conversation__is_group=False)
        .values_list("conversation_id", flat=True)
    )
    theirs = set(
        ConversationMember.objects.filter(account_id=b_id, conversation_id__in=mine)
        .values_list("conversation_id", flat=True)
    )
    for cid in sorted(theirs):
        if ConversationMember.objects.filter(conversation_id=cid).count() == 2:
            return Conversation.objects.get(id=cid)
    return None


def start_conversation(me_id, member_ids, title=""):
    try:
        ids = {int(i) for i in (member_ids or [])} - {me_id}
    except (TypeError, ValueError):
        raise ChatError("Choose who to message.")
    if not ids:
        raise ChatError("Choose who to message.")
    title = (title or "").strip()[:60]

    not_friends = ids - _friend_ids(me_id)
    if not_friends:
        raise ChatError("You can only message your friends.", 403)

    if len(ids) == 1 and not title:
        other = next(iter(ids))
        existing = _find_dm(me_id, other)
        if existing:
            return serialize_conversation(existing, me_id), False

    if len(ids) + 1 > Conversation.MAX_GROUP_MEMBERS:
        raise ChatError(f"Groups can have up to {Conversation.MAX_GROUP_MEMBERS} people.")

    with transaction.atomic():
        conv = Conversation.objects.create(
            is_group=len(ids) > 1 or bool(title), title=title, created_by_id=me_id
        )
        now = timezone.now()
        ConversationMember.objects.bulk_create(
            [ConversationMember(conversation=conv, account_id=me_id, last_read_at=now)]
            + [ConversationMember(conversation=conv, account_id=i) for i in ids]
        )
    data = serialize_conversation(conv, me_id)
    broadcast(conv.id, {"type": "chat_conversation", "conversation_id": conv.id})
    return data, True


def send_message(conversation_id, me_id, body):
    body = (body or "").strip()
    if not body:
        raise ChatError("Message can't be empty.")
    if len(body) > Message.MAX_LENGTH:
        raise ChatError(f"Messages can be up to {Message.MAX_LENGTH} characters.")
    member = _membership(conversation_id, me_id)
    conv = member.conversation

    if not conv.is_group:
        # 1:1 chats only work while you're still friends.
        other = (
            ConversationMember.objects.filter(conversation=conv)
            .exclude(account_id=me_id)
            .values_list("account_id", flat=True)
            .first()
        )
        if other is None or other not in _friend_ids(me_id):
            raise ChatError("You can only message your friends.", 403)

    with transaction.atomic():
        msg = Message.objects.create(conversation=conv, sender_id=me_id, body=body)
        Conversation.objects.filter(id=conv.id).update(updated_at=msg.created_at)
        # Sending counts as having read everything before it.
        ConversationMember.objects.filter(pk=member.pk).update(last_read_at=msg.created_at)

    data = serialize_message(msg)
    broadcast(conv.id, {"type": "chat_message", "message": data})
    return data


def mark_read(conversation_id, me_id):
    member = _membership(conversation_id, me_id)
    now = timezone.now()
    ConversationMember.objects.filter(pk=member.pk).update(last_read_at=now)
    broadcast(
        conversation_id,
        {"type": "chat_read", "conversation_id": conversation_id, "account_id": me_id,
         "read_at": now.isoformat()},
    )
    return {"read_at": now.isoformat()}


def edit_message(message_id, me_id, body):
    body = (body or "").strip()
    if not body:
        raise ChatError("Message can't be empty.")
    if len(body) > Message.MAX_LENGTH:
        raise ChatError(f"Messages can be up to {Message.MAX_LENGTH} characters.")
    msg = Message.objects.filter(id=message_id, sender_id=me_id, is_deleted=False).first()
    if not msg:
        raise ChatError("Message not found.", 404)
    msg.body = body
    msg.edited_at = timezone.now()
    msg.save(update_fields=["body", "edited_at"])
    data = serialize_message(msg)
    broadcast(msg.conversation_id, {"type": "chat_message_updated", "message": data})
    return data


def delete_message(message_id, me_id):
    msg = Message.objects.filter(id=message_id, sender_id=me_id).first()
    if not msg:
        raise ChatError("Message not found.", 404)
    msg.is_deleted = True
    msg.body = ""
    msg.save(update_fields=["is_deleted", "body"])
    data = serialize_message(msg)
    broadcast(msg.conversation_id, {"type": "chat_message_updated", "message": data})
    return data


def rename_group(conversation_id, me_id, title):
    member = _membership(conversation_id, me_id)
    conv = member.conversation
    if not conv.is_group:
        raise ChatError("Only group chats have a name.")
    conv.title = (title or "").strip()[:60]
    conv.save(update_fields=["title"])
    broadcast(conv.id, {"type": "chat_conversation", "conversation_id": conv.id})
    return serialize_conversation(conv, me_id)


def add_members(conversation_id, me_id, member_ids):
    member = _membership(conversation_id, me_id)
    conv = member.conversation
    if not conv.is_group:
        raise ChatError("You can only add people to group chats.")
    try:
        ids = {int(i) for i in (member_ids or [])}
    except (TypeError, ValueError):
        raise ChatError("Choose who to add.")
    ids -= set(_member_ids(conv.id))
    if not ids:
        raise ChatError("They're already in this chat.")
    if ids - _friend_ids(me_id):
        raise ChatError("You can only add your friends.", 403)
    if len(_member_ids(conv.id)) + len(ids) > Conversation.MAX_GROUP_MEMBERS:
        raise ChatError(f"Groups can have up to {Conversation.MAX_GROUP_MEMBERS} people.")
    ConversationMember.objects.bulk_create(
        [ConversationMember(conversation=conv, account_id=i) for i in ids]
    )
    broadcast(conv.id, {"type": "chat_conversation", "conversation_id": conv.id})
    return serialize_conversation(conv, me_id)


def leave(conversation_id, me_id):
    member = _membership(conversation_id, me_id)
    conv = member.conversation
    if not conv.is_group:
        raise ChatError("You can't leave a 1:1 chat.")
    member.delete()
    if not ConversationMember.objects.filter(conversation=conv).exists():
        conv.delete()
    else:
        broadcast(conv.id, {"type": "chat_conversation", "conversation_id": conv.id})
    return {"left": True}


def can_type_in(conversation_id, me_id):
    return ConversationMember.objects.filter(
        conversation_id=conversation_id, account_id=me_id
    ).exists()

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils import timezone

from friends.queries import friend_ids
from GlowProject.db import execute, execute_many, fetch_all, fetch_column, fetch_one, fetch_value

log = logging.getLogger(__name__)

MAX_GROUP_MEMBERS = 20
MAX_MESSAGE_LENGTH = 2000
MAX_TITLE_LENGTH = 60


class ChatError(Exception):  # a problem to show the user, with the HTTP status to send
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def iso(value):
    return value.isoformat() if value else None


def member_ids(conversation_id):
    return fetch_column(
        "SELECT account_id FROM glow.glow.messaging_conversationmember WHERE conversation_id = %s",
        (conversation_id,),
    )


def conversation_if_member(conversation_id, me_id):  # the conversation row, or a 404 if it doesn't exist or you're not in it
    conversation = fetch_one(
        """
        SELECT c.id, c.is_group, c.title, c.created_by_id, c.updated_at
        FROM glow.glow.messaging_conversation c
        JOIN glow.glow.messaging_conversationmember cm ON cm.conversation_id = c.id
        WHERE c.id = %s AND cm.account_id = %s
        """,
        (conversation_id, me_id),
    )
    if not conversation:
        raise ChatError("Conversation not found.", 404)
    return conversation


def broadcast(conversation_id, event):  # push `event` to every member's personal WebSocket group (best effort)
    layer = get_channel_layer()
    for account_id in member_ids(conversation_id):
        try:
            async_to_sync(layer.group_send)(f"user_{account_id}", event)
        except Exception:  # Redis down etc.: the HTTP request still worked
            log.warning("Realtime push failed", exc_info=True)


def clean_body(body):
    body = (body or "").strip()
    if not body:
        raise ChatError("Message can't be empty.")
    if len(body) > MAX_MESSAGE_LENGTH:
        raise ChatError(f"Messages can be up to {MAX_MESSAGE_LENGTH} characters.")
    return body


def clean_ids(values, error_message):
    try:
        return {int(v) for v in (values or [])}
    except (TypeError, ValueError):
        raise ChatError(error_message)


def message_dict(row):
    deleted = row["is_deleted"]
    return {
        "id": row["id"],
        "conversation_id": row["conversation_id"],
        "sender_id": row["sender_id"],
        "body": "" if deleted else row["body"],
        "is_deleted": deleted,
        "edited": row["edited_at"] is not None and not deleted,
        "created_at": row["created_at"].isoformat(),
    }


MESSAGE_COLUMNS = "id, conversation_id, sender_id, body, created_at, edited_at, is_deleted"


def members_of(conversation_ids):  # {conversation_id: [member rows]} with each member's name and photo
    if not conversation_ids:
        return {}
    rows = fetch_all(
        """
        SELECT cm.conversation_id, cm.account_id, cm.last_read_at,
               a.firstname, a.lastname, a.profile_photo, u.username
        FROM glow.glow.messaging_conversationmember cm
        JOIN glow.glow.accounts_account a ON a.id = cm.account_id
        LEFT JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE cm.conversation_id = ANY(%s)
        ORDER BY cm.id
        """,
        (list(conversation_ids),),
    )
    members = {}
    for row in rows:
        members.setdefault(row["conversation_id"], []).append(row)
    return members


def conversation_dict(conversation, me_id, members, unread=0, last_message=None):
    others = [m for m in members if m["account_id"] != me_id]
    mine = next((m for m in members if m["account_id"] == me_id), None)

    if conversation["is_group"]:
        name = conversation["title"] or ", ".join(
            (o["firstname"] or o["username"] or "") for o in others[:3]
        ) or "Group chat"
    elif others:
        other = others[0]
        full_name = " ".join(filter(None, [other["firstname"], other["lastname"]]))
        name = full_name or other["username"]
    else:
        name = "Deleted user"

    return {
        "id": conversation["id"],
        "is_group": conversation["is_group"],
        "title": conversation["title"],
        "name": name,
        "members": [
            {
                "id": m["account_id"],
                "username": m["username"] or "",
                "firstname": m["firstname"] or "",
                "lastname": m["lastname"] or "",
                "profile_photo": m["profile_photo"] or "",
            }
            for m in members
        ],
        "member_reads": {str(m["account_id"]): iso(m["last_read_at"]) for m in members},
        "created_by": conversation["created_by_id"],
        "updated_at": conversation["updated_at"].isoformat(),
        "unread": unread,
        "last_message": last_message,
        "my_last_read_at": iso(mine["last_read_at"]) if mine else None,
    }


def conversation_for(conversation_id, me_id):
    conversation = conversation_if_member(conversation_id, me_id)
    members = members_of([conversation_id]).get(conversation_id, [])
    return conversation_dict(conversation, me_id, members)


def list_conversations(me_id, limit=50):  # your inbox: newest activity first, with the last message and how many unread messages each chat has
    conversations = fetch_all(
        """
        SELECT c.id, c.is_group, c.title, c.created_by_id, c.updated_at,
               -- unread = messages from others after you last read the chat
               (SELECT COUNT(*) FROM glow.glow.messaging_message m
                WHERE m.conversation_id = c.id
                  AND m.is_deleted = FALSE
                  AND m.sender_id <> %(me)s
                  AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
               ) AS unread,
               (SELECT MAX(m.id) FROM glow.glow.messaging_message m
                WHERE m.conversation_id = c.id
               ) AS last_message_id
        FROM glow.glow.messaging_conversation c
        JOIN glow.glow.messaging_conversationmember cm
          ON cm.conversation_id = c.id AND cm.account_id = %(me)s
        ORDER BY c.updated_at DESC
        LIMIT %(limit)s
        """,
        {"me": me_id, "limit": limit},
    )

    last_ids = [c["last_message_id"] for c in conversations if c["last_message_id"]]
    last_messages = {}
    if last_ids:
        rows = fetch_all(
            f"SELECT {MESSAGE_COLUMNS} FROM glow.glow.messaging_message WHERE id = ANY(%s)",
            (last_ids,),
        )
        last_messages = {row["conversation_id"]: message_dict(row) for row in rows}

    members = members_of([c["id"] for c in conversations])
    return [
        conversation_dict(
            c,
            me_id,
            members.get(c["id"], []),
            unread=c["unread"],
            last_message=last_messages.get(c["id"]),
        )
        for c in conversations
    ]


def count_unread_chats(me_id):  # how many of your conversations have unread messages (the nav badge)
    return fetch_value(
        """
        SELECT COUNT(*)
        FROM glow.glow.messaging_conversationmember cm
        WHERE cm.account_id = %(me)s
          AND EXISTS (
              SELECT 1 FROM glow.glow.messaging_message m
              WHERE m.conversation_id = cm.conversation_id
                AND m.is_deleted = FALSE
                AND m.sender_id <> %(me)s
                AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
          )
        """,
        {"me": me_id},
    )


def get_conversation(conversation_id, me_id):
    return conversation_for(conversation_id, me_id)


def list_messages(conversation_id, me_id, before=None, limit=30):  # one page of messages, oldest first
    conversation_if_member(conversation_id, me_id)
    page = fetch_all(
        f"""
        SELECT {MESSAGE_COLUMNS}
        FROM glow.glow.messaging_message
        WHERE conversation_id = %(cid)s
          AND (%(before)s::int IS NULL OR id < %(before)s::int)
        ORDER BY id DESC
        LIMIT %(limit)s
        """,
        {"cid": conversation_id, "before": before, "limit": limit + 1},  # one extra row tells us if older messages exist
    )
    has_more = len(page) > limit
    page = list(reversed(page[:limit]))
    return {"results": [message_dict(m) for m in page], "has_more": has_more}


def find_direct_chat(a_id, b_id):  # the existing 1:1 chat between two people, if any
    return fetch_value(
        """
        SELECT c.id
        FROM glow.glow.messaging_conversation c
        WHERE c.is_group = FALSE
          AND EXISTS (SELECT 1 FROM glow.glow.messaging_conversationmember
                      WHERE conversation_id = c.id AND account_id = %s)
          AND EXISTS (SELECT 1 FROM glow.glow.messaging_conversationmember
                      WHERE conversation_id = c.id AND account_id = %s)
          AND (SELECT COUNT(*) FROM glow.glow.messaging_conversationmember
               WHERE conversation_id = c.id) = 2
        ORDER BY c.id
        LIMIT 1
        """,
        (a_id, b_id),
    )


def start_conversation(me_id, people_ids, title=""):  # returns (chat, created); reopens an existing 1:1
    ids = clean_ids(people_ids, "Choose who to message.") - {me_id}
    if not ids:
        raise ChatError("Choose who to message.")
    title = (title or "").strip()[:MAX_TITLE_LENGTH]

    if ids - set(friend_ids(me_id)):
        raise ChatError("You can only message your friends.", 403)

    if len(ids) == 1 and not title:  # a 1:1 with someone you already talk to: reopen it
        existing = find_direct_chat(me_id, next(iter(ids)))
        if existing:
            return conversation_for(existing, me_id), False

    if len(ids) + 1 > MAX_GROUP_MEMBERS:
        raise ChatError(f"Groups can have up to {MAX_GROUP_MEMBERS} people.")

    now = timezone.now()
    with transaction.atomic():
        conversation_id = fetch_value(
            """
            INSERT INTO glow.glow.messaging_conversation
                (is_group, title, created_by_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (len(ids) > 1 or bool(title), title, me_id, now, now),
        )
        members = [(conversation_id, me_id, now, now)] + [  # you've "read" the new chat; the others haven't
            (conversation_id, account_id, now, None) for account_id in ids
        ]
        execute_many(
            """
            INSERT INTO glow.glow.messaging_conversationmember
                (conversation_id, account_id, joined_at, last_read_at)
            VALUES (%s, %s, %s, %s)
            """,
            members,
        )

    data = conversation_for(conversation_id, me_id)
    broadcast(conversation_id, {"type": "chat_conversation", "conversation_id": conversation_id})
    return data, True


def send_message(conversation_id, me_id, body):
    body = clean_body(body)
    conversation = conversation_if_member(conversation_id, me_id)

    if not conversation["is_group"]:  # 1:1 chats only work while you're still friends
        others = [i for i in member_ids(conversation_id) if i != me_id]
        if not others or others[0] not in friend_ids(me_id):
            raise ChatError("You can only message your friends.", 403)

    now = timezone.now()
    with transaction.atomic():
        message = message_dict(fetch_one(
            f"""
            INSERT INTO glow.glow.messaging_message
                (conversation_id, sender_id, body, created_at, edited_at, is_deleted)
            VALUES (%s, %s, %s, %s, NULL, FALSE)
            RETURNING {MESSAGE_COLUMNS}
            """,
            (conversation_id, me_id, body, now),
        ))
        execute(  # bump the chat to the top of everyone's inbox
            "UPDATE glow.glow.messaging_conversation SET updated_at = %s WHERE id = %s",
            (now, conversation_id),
        )
        execute(  # sending counts as having read everything before it
            """
            UPDATE glow.glow.messaging_conversationmember SET last_read_at = %s
            WHERE conversation_id = %s AND account_id = %s
            """,
            (now, conversation_id, me_id),
        )

    broadcast(conversation_id, {"type": "chat_message", "message": message})
    return message


def mark_read(conversation_id, me_id):
    conversation_if_member(conversation_id, me_id)
    now = timezone.now()
    execute(
        """
        UPDATE glow.glow.messaging_conversationmember SET last_read_at = %s
        WHERE conversation_id = %s AND account_id = %s
        """,
        (now, conversation_id, me_id),
    )
    broadcast(
        conversation_id,
        {"type": "chat_read", "conversation_id": conversation_id, "account_id": me_id,
         "read_at": now.isoformat()},
    )
    return {"read_at": now.isoformat()}


def edit_message(message_id, me_id, body):  # edit your own (not deleted) message
    body = clean_body(body)
    row = fetch_one(
        f"""
        UPDATE glow.glow.messaging_message SET body = %s, edited_at = %s
        WHERE id = %s AND sender_id = %s AND is_deleted = FALSE
        RETURNING {MESSAGE_COLUMNS}
        """,
        (body, timezone.now(), message_id, me_id),
    )
    if not row:
        raise ChatError("Message not found.", 404)
    message = message_dict(row)
    broadcast(row["conversation_id"], {"type": "chat_message_updated", "message": message})
    return message


def delete_message(message_id, me_id):  # soft delete: the message stays as "Message deleted", without its text
    row = fetch_one(
        f"""
        UPDATE glow.glow.messaging_message SET is_deleted = TRUE, body = ''
        WHERE id = %s AND sender_id = %s
        RETURNING {MESSAGE_COLUMNS}
        """,
        (message_id, me_id),
    )
    if not row:
        raise ChatError("Message not found.", 404)
    message = message_dict(row)
    broadcast(row["conversation_id"], {"type": "chat_message_updated", "message": message})
    return message


def rename_group(conversation_id, me_id, title):
    conversation = conversation_if_member(conversation_id, me_id)
    if not conversation["is_group"]:
        raise ChatError("Only group chats have a name.")
    execute(
        "UPDATE glow.glow.messaging_conversation SET title = %s WHERE id = %s",
        ((title or "").strip()[:MAX_TITLE_LENGTH], conversation_id),
    )
    broadcast(conversation_id, {"type": "chat_conversation", "conversation_id": conversation_id})
    return conversation_for(conversation_id, me_id)


def add_members(conversation_id, me_id, people_ids):  # add friends to a group chat
    conversation = conversation_if_member(conversation_id, me_id)
    if not conversation["is_group"]:
        raise ChatError("You can only add people to group chats.")
    current = set(member_ids(conversation_id))
    ids = clean_ids(people_ids, "Choose who to add.") - current
    if not ids:
        raise ChatError("They're already in this chat.")
    if ids - set(friend_ids(me_id)):
        raise ChatError("You can only add your friends.", 403)
    if len(current) + len(ids) > MAX_GROUP_MEMBERS:
        raise ChatError(f"Groups can have up to {MAX_GROUP_MEMBERS} people.")

    now = timezone.now()
    execute_many(
        """
        INSERT INTO glow.glow.messaging_conversationmember
            (conversation_id, account_id, joined_at, last_read_at)
        VALUES (%s, %s, %s, NULL)
        """,
        [(conversation_id, account_id, now) for account_id in ids],
    )
    broadcast(conversation_id, {"type": "chat_conversation", "conversation_id": conversation_id})
    return conversation_for(conversation_id, me_id)


def leave_conversation(conversation_id, me_id):  # leave a group
    conversation = conversation_if_member(conversation_id, me_id)
    if not conversation["is_group"]:
        raise ChatError("You can't leave a 1:1 chat.")
    with transaction.atomic():
        execute(
            """
            DELETE FROM glow.glow.messaging_conversationmember
            WHERE conversation_id = %s AND account_id = %s
            """,
            (conversation_id, me_id),
        )
        still_open = bool(member_ids(conversation_id))
        if not still_open:  # nobody left: delete the messages, then the chat itself
            execute(
                "DELETE FROM glow.glow.messaging_message WHERE conversation_id = %s",
                (conversation_id,),
            )
            execute(
                "DELETE FROM glow.glow.messaging_conversation WHERE id = %s",
                (conversation_id,),
            )
    if still_open:
        broadcast(conversation_id, {"type": "chat_conversation", "conversation_id": conversation_id})
    return {"left": True}

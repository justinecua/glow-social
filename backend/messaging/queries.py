"""Direct messages and group chats (SQL queries).

Rules:
  - You can only start a chat with (or add to a group) people you're friends with.
  - Only members can read or post in a conversation.
  - A 1:1 chat between two people is unique: starting it again reopens it.
  - Groups hold up to MAX_GROUP_MEMBERS people.

Tables:
  messaging_conversation        id, is_group, title, created_by_id, created_at, updated_at
  messaging_conversationmember  id, conversation_id, account_id, joined_at, last_read_at
  messaging_message             id, conversation_id, sender_id, body, created_at,
                                edited_at, is_deleted
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import connections, transaction
from django.utils import timezone

MAX_GROUP_MEMBERS = 20
MAX_MESSAGE_LENGTH = 2000
MAX_TITLE_LENGTH = 60


class ChatError(Exception):
    """A problem to show the user, with the HTTP status to send."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


# ---------------------------------------------------------------- helpers
def _rows(cursor):
    """All rows of the last query as a list of dicts."""
    columns = [c[0] for c in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _row(cursor):
    rows = _rows(cursor)
    return rows[0] if rows else None


def _iso(value):
    return value.isoformat() if value else None


def friendIds(account_id):
    """Ids of everyone this account is friends with."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT CASE WHEN user_id = %s THEN friend_id ELSE user_id END
            FROM glow.glow.friends_friend
            WHERE status = 'Friends' AND (user_id = %s OR friend_id = %s)
            """,
            (account_id, account_id, account_id),
        )
        return {row[0] for row in cursor.fetchall()}


def memberIds(conversation_id):
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT account_id FROM glow.glow.messaging_conversationmember
            WHERE conversation_id = %s
            """,
            (conversation_id,),
        )
        return [row[0] for row in cursor.fetchall()]


def canTypeIn(conversation_id, account_id):
    """Is this account a member (used by the realtime "typing…" indicator)?"""
    return account_id in memberIds(conversation_id)


def _getConversationIfMember(conversation_id, me_id):
    """The conversation row, or a 404 if it doesn't exist or you're not in it."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            SELECT c.id, c.is_group, c.title, c.created_by_id, c.updated_at
            FROM glow.glow.messaging_conversation c
            JOIN glow.glow.messaging_conversationmember cm ON cm.conversation_id = c.id
            WHERE c.id = %s AND cm.account_id = %s
            """,
            (conversation_id, me_id),
        )
        conversation = _row(cursor)
    if not conversation:
        raise ChatError("Conversation not found.", 404)
    return conversation


def broadcast(conversation_id, event):
    """Push `event` to every member's personal WebSocket group (best effort)."""
    layer = get_channel_layer()
    for account_id in memberIds(conversation_id):
        try:
            async_to_sync(layer.group_send)(f"user_{account_id}", event)
        except Exception as error:  # Redis down etc.: the HTTP request still worked
            print(f"Realtime push failed: {error}")


def _cleanBody(body):
    body = (body or "").strip()
    if not body:
        raise ChatError("Message can't be empty.")
    if len(body) > MAX_MESSAGE_LENGTH:
        raise ChatError(f"Messages can be up to {MAX_MESSAGE_LENGTH} characters.")
    return body


def _cleanIds(values, error_message):
    try:
        return {int(v) for v in (values or [])}
    except (TypeError, ValueError):
        raise ChatError(error_message)


# ---------------------------------------------------------------- shaping data
def _messageDict(row):
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


def _membersOf(conversation_ids):
    """{conversation_id: [member rows]} with each member's name and photo."""
    if not conversation_ids:
        return {}
    with connections["default"].cursor() as cursor:
        cursor.execute(
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
        for row in _rows(cursor):
            members.setdefault(row["conversation_id"], []).append(row)
        return members


def _conversationDict(conversation, me_id, members, unread=0, last_message=None):
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
        "member_reads": {str(m["account_id"]): _iso(m["last_read_at"]) for m in members},
        "created_by": conversation["created_by_id"],
        "updated_at": conversation["updated_at"].isoformat(),
        "unread": unread,
        "last_message": last_message,
        "my_last_read_at": _iso(mine["last_read_at"]) if mine else None,
    }


def _conversationFor(conversation_id, me_id):
    conversation = _getConversationIfMember(conversation_id, me_id)
    members = _membersOf([conversation_id]).get(conversation_id, [])
    return _conversationDict(conversation, me_id, members)


# ---------------------------------------------------------------- reading
def listConversations(me_id, limit=50):
    """Your inbox: newest activity first, with the last message and how many
    unread messages each chat has."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
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
        conversations = _rows(cursor)

        last_ids = [c["last_message_id"] for c in conversations if c["last_message_id"]]
        last_messages = {}
        if last_ids:
            cursor.execute(
                f"SELECT {MESSAGE_COLUMNS} FROM glow.glow.messaging_message WHERE id = ANY(%s)",
                (last_ids,),
            )
            last_messages = {row["conversation_id"]: _messageDict(row) for row in _rows(cursor)}

    members = _membersOf([c["id"] for c in conversations])
    return [
        _conversationDict(
            c,
            me_id,
            members.get(c["id"], []),
            unread=c["unread"],
            last_message=last_messages.get(c["id"]),
        )
        for c in conversations
    ]


def unreadTotal(me_id):
    """How many of your conversations have unread messages (the nav badge)."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
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
        return cursor.fetchone()[0]


def getConversation(conversation_id, me_id):
    return _conversationFor(conversation_id, me_id)


def listMessages(conversation_id, me_id, before=None, limit=30):
    """One page of messages, oldest first. `before` = load older than this id."""
    _getConversationIfMember(conversation_id, me_id)
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"""
            SELECT {MESSAGE_COLUMNS}
            FROM glow.glow.messaging_message
            WHERE conversation_id = %(cid)s
              AND (%(before)s::int IS NULL OR id < %(before)s::int)
            ORDER BY id DESC
            LIMIT %(limit)s
            """,
            # Fetch one extra row to know if there are older messages.
            {"cid": conversation_id, "before": before, "limit": limit + 1},
        )
        page = _rows(cursor)
    has_more = len(page) > limit
    page = list(reversed(page[:limit]))
    return {"results": [_messageDict(m) for m in page], "has_more": has_more}


# ---------------------------------------------------------------- starting chats
def _findDirectChat(a_id, b_id):
    """The existing 1:1 chat between two people, if any."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
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
        row = cursor.fetchone()
        return row[0] if row else None


def startConversation(me_id, member_ids, title=""):
    """Start a chat (or reopen your existing 1:1). Returns (chat, created)."""
    ids = _cleanIds(member_ids, "Choose who to message.") - {me_id}
    if not ids:
        raise ChatError("Choose who to message.")
    title = (title or "").strip()[:MAX_TITLE_LENGTH]

    if ids - friendIds(me_id):
        raise ChatError("You can only message your friends.", 403)

    # A 1:1 chat with someone you already talk to: reopen it.
    if len(ids) == 1 and not title:
        existing = _findDirectChat(me_id, next(iter(ids)))
        if existing:
            return _conversationFor(existing, me_id), False

    if len(ids) + 1 > MAX_GROUP_MEMBERS:
        raise ChatError(f"Groups can have up to {MAX_GROUP_MEMBERS} people.")

    now = timezone.now()
    with transaction.atomic(), connections["default"].cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO glow.glow.messaging_conversation
                (is_group, title, created_by_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (len(ids) > 1 or bool(title), title, me_id, now, now),
        )
        conversation_id = cursor.fetchone()[0]
        # You've "read" the new chat; the others haven't yet.
        members = [(conversation_id, me_id, now, now)] + [
            (conversation_id, account_id, now, None) for account_id in ids
        ]
        cursor.executemany(
            """
            INSERT INTO glow.glow.messaging_conversationmember
                (conversation_id, account_id, joined_at, last_read_at)
            VALUES (%s, %s, %s, %s)
            """,
            members,
        )

    data = _conversationFor(conversation_id, me_id)
    broadcast(conversation_id, {"type": "chat_conversation", "conversation_id": conversation_id})
    return data, True


# ---------------------------------------------------------------- messages
def sendMessage(conversation_id, me_id, body):
    body = _cleanBody(body)
    conversation = _getConversationIfMember(conversation_id, me_id)

    # 1:1 chats only work while you're still friends.
    if not conversation["is_group"]:
        others = [i for i in memberIds(conversation_id) if i != me_id]
        if not others or others[0] not in friendIds(me_id):
            raise ChatError("You can only message your friends.", 403)

    now = timezone.now()
    with transaction.atomic(), connections["default"].cursor() as cursor:
        cursor.execute(
            f"""
            INSERT INTO glow.glow.messaging_message
                (conversation_id, sender_id, body, created_at, edited_at, is_deleted)
            VALUES (%s, %s, %s, %s, NULL, FALSE)
            RETURNING {MESSAGE_COLUMNS}
            """,
            (conversation_id, me_id, body, now),
        )
        message = _messageDict(_row(cursor))
        # Bump the chat to the top of everyone's inbox.
        cursor.execute(
            "UPDATE glow.glow.messaging_conversation SET updated_at = %s WHERE id = %s",
            (now, conversation_id),
        )
        # Sending counts as having read everything before it.
        cursor.execute(
            """
            UPDATE glow.glow.messaging_conversationmember SET last_read_at = %s
            WHERE conversation_id = %s AND account_id = %s
            """,
            (now, conversation_id, me_id),
        )

    broadcast(conversation_id, {"type": "chat_message", "message": message})
    return message


def markRead(conversation_id, me_id):
    _getConversationIfMember(conversation_id, me_id)
    now = timezone.now()
    with connections["default"].cursor() as cursor:
        cursor.execute(
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


def editMessage(message_id, me_id, body):
    """Edit your own (not deleted) message."""
    body = _cleanBody(body)
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"""
            UPDATE glow.glow.messaging_message SET body = %s, edited_at = %s
            WHERE id = %s AND sender_id = %s AND is_deleted = FALSE
            RETURNING {MESSAGE_COLUMNS}
            """,
            (body, timezone.now(), message_id, me_id),
        )
        row = _row(cursor)
    if not row:
        raise ChatError("Message not found.", 404)
    message = _messageDict(row)
    broadcast(row["conversation_id"], {"type": "chat_message_updated", "message": message})
    return message


def deleteMessage(message_id, me_id):
    """Soft delete: the message stays as "Message deleted", without its text."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            f"""
            UPDATE glow.glow.messaging_message SET is_deleted = TRUE, body = ''
            WHERE id = %s AND sender_id = %s
            RETURNING {MESSAGE_COLUMNS}
            """,
            (message_id, me_id),
        )
        row = _row(cursor)
    if not row:
        raise ChatError("Message not found.", 404)
    message = _messageDict(row)
    broadcast(row["conversation_id"], {"type": "chat_message_updated", "message": message})
    return message


# ---------------------------------------------------------------- groups
def renameGroup(conversation_id, me_id, title):
    conversation = _getConversationIfMember(conversation_id, me_id)
    if not conversation["is_group"]:
        raise ChatError("Only group chats have a name.")
    with connections["default"].cursor() as cursor:
        cursor.execute(
            "UPDATE glow.glow.messaging_conversation SET title = %s WHERE id = %s",
            ((title or "").strip()[:MAX_TITLE_LENGTH], conversation_id),
        )
    broadcast(conversation_id, {"type": "chat_conversation", "conversation_id": conversation_id})
    return _conversationFor(conversation_id, me_id)


def addMembers(conversation_id, me_id, member_ids):
    """Add friends to a group chat."""
    conversation = _getConversationIfMember(conversation_id, me_id)
    if not conversation["is_group"]:
        raise ChatError("You can only add people to group chats.")
    current = set(memberIds(conversation_id))
    ids = _cleanIds(member_ids, "Choose who to add.") - current
    if not ids:
        raise ChatError("They're already in this chat.")
    if ids - friendIds(me_id):
        raise ChatError("You can only add your friends.", 403)
    if len(current) + len(ids) > MAX_GROUP_MEMBERS:
        raise ChatError(f"Groups can have up to {MAX_GROUP_MEMBERS} people.")

    now = timezone.now()
    with connections["default"].cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO glow.glow.messaging_conversationmember
                (conversation_id, account_id, joined_at, last_read_at)
            VALUES (%s, %s, %s, NULL)
            """,
            [(conversation_id, account_id, now) for account_id in ids],
        )
    broadcast(conversation_id, {"type": "chat_conversation", "conversation_id": conversation_id})
    return _conversationFor(conversation_id, me_id)


def leaveConversation(conversation_id, me_id):
    """Leave a group. The last person to leave deletes the chat."""
    conversation = _getConversationIfMember(conversation_id, me_id)
    if not conversation["is_group"]:
        raise ChatError("You can't leave a 1:1 chat.")
    with transaction.atomic(), connections["default"].cursor() as cursor:
        cursor.execute(
            """
            DELETE FROM glow.glow.messaging_conversationmember
            WHERE conversation_id = %s AND account_id = %s
            """,
            (conversation_id, me_id),
        )
        if memberIds(conversation_id):
            still_open = True
        else:
            still_open = False
            # Nobody left: delete the messages, then the chat itself.
            cursor.execute(
                "DELETE FROM glow.glow.messaging_message WHERE conversation_id = %s",
                (conversation_id,),
            )
            cursor.execute(
                "DELETE FROM glow.glow.messaging_conversation WHERE id = %s",
                (conversation_id,),
            )
    if still_open:
        broadcast(conversation_id, {"type": "chat_conversation", "conversation_id": conversation_id})
    return {"left": True}

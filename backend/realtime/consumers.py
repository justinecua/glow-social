from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
import json
from asgiref.sync import sync_to_async
from friends.queries import (
    addFriend,
    cancelFriendRequest,
    acceptFriend,
    unfriend,
)

from notifications.queries import (
    showNotificationsByUser,
    countNotifications
)

ACTIONS = {
    "add_friend_result": addFriend,
    "cancel_friend_request": cancelFriendRequest,
    "accept_friend_result": acceptFriend,
    "unfriend": unfriend,
}

class GlobalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Identity comes from WebSocketAuthMiddleware (ticket or cookie),
        # never from the ?user_id= the client sends.
        self.user_id = self.scope.get("account_id")
        if not self.user_id:
            await self.close(code=4401)
            return

        self.room_group_name = f"user_{self.user_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        print(f"[WebSocket] User connected: user_id={self.user_id}")

    async def disconnect(self, close_code):
        if getattr(self, "room_group_name", None):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (ValueError, TypeError):
            return

        # Typing indicator: only members of the conversation may signal it.
        if data.get("type") == "typing":
            await self.relay_typing(data.get("conversation_id"))
            return

        try:
            friend_id = int(data.get("friend_id"))
        except (ValueError, TypeError):
            return
        event_type = data.get("type")
        # The actor is always the authenticated user; a client-sent
        # "user_id" is ignored so nobody can act on someone else's behalf.
        user_id = self.user_id
        if friend_id == user_id:
            return

        handler = ACTIONS.get(event_type)
        if handler:
            result = await sync_to_async(handler, thread_sensitive=True)(friend_id, user_id)
            await self.notify_both(event_type, result, user_id, friend_id)

    async def notify_both(self, event_type, result, user_id, friend_id):
        for uid, fid in [(user_id, friend_id), (friend_id, user_id)]:
            await self.channel_layer.group_send(
                f"user_{uid}",
                {
                    "type": event_type,
                    "status": result["status"],
                    "message": result["message"],
                    "friend_id": fid,
                }
            )

            await self.channel_layer.group_send(
                f"user_{uid}",
                {
                    "type": "refresh_friend_status",
                    "user_id": user_id,
                    "friend_id": friend_id,
                }
            )

            notification_count = await sync_to_async(countNotifications)(friend_id)
            notifications = await sync_to_async(showNotificationsByUser)(friend_id)

            await self.channel_layer.group_send(
                f"user_{friend_id}",
                {
                    "type": "new_notification",
                    "from_user_id": user_id,
                    "count": notification_count,
                    "notifications": notifications
                }
            )

    async def add_friend_result(self, event):
        await self.send(text_data=json.dumps(event))

    async def cancel_friend_request(self, event):
        await self.send(text_data=json.dumps(event))

    async def accept_friend_result(self, event):
        await self.send(text_data=json.dumps(event))

    async def unfriend(self, event):
        await self.send(text_data=json.dumps(event))
    
    async def refresh_friend_status(self, event):
        await self.send(text_data=json.dumps(event))

    async def new_notification(self, event):
        await self.send(text_data=json.dumps({
            "type": "notification",
            "from_user_id": event["from_user_id"],
            "count": event["count"],
            "notifications": event["notifications"]
        }))

    # ------------------------------------------------------------ messaging
    async def relay_typing(self, conversation_id):
        from messaging.services import can_type_in, _member_ids

        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            return
        if not await sync_to_async(can_type_in)(conversation_id, self.user_id):
            return
        for uid in await sync_to_async(_member_ids)(conversation_id):
            if uid != self.user_id:
                await self.channel_layer.group_send(
                    f"user_{uid}",
                    {"type": "chat_typing", "conversation_id": conversation_id,
                     "account_id": self.user_id},
                )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    async def chat_message_updated(self, event):
        await self.send(text_data=json.dumps(event))

    async def chat_read(self, event):
        await self.send(text_data=json.dumps(event))

    async def chat_typing(self, event):
        await self.send(text_data=json.dumps(event))

    async def chat_conversation(self, event):
        await self.send(text_data=json.dumps(event))

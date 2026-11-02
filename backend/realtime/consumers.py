import json
import logging

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from friends.queries import accept_friend, add_friend, cancel_friend_request, unfriend
from messaging.queries import member_ids
from notifications.queries import push_notifications

log = logging.getLogger(__name__)

FRIEND_ACTIONS = {  # message type from the app -> function that does it
    "add_friend_result": add_friend,
    "cancel_friend_request": cancel_friend_request,
    "accept_friend_result": accept_friend,
    "unfriend": unfriend,
}


class GlobalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope.get("account_id")  # set by WebSocketAuthMiddleware, never by the client
        if not self.user_id:
            await self.close(code=4401)
            return
        self.room_group_name = f"user_{self.user_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if getattr(self, "room_group_name", None):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (ValueError, TypeError):
            return

        if data.get("type") == "typing":
            await self.relay_typing(data.get("conversation_id"))
        elif data.get("type") in FRIEND_ACTIONS:
            await self.run_friend_action(data.get("type"), data.get("friend_id"))

    async def run_friend_action(self, event_type, friend_id):
        try:
            friend_id = int(friend_id)
        except (TypeError, ValueError):
            return
        if friend_id == self.user_id:
            return

        try:
            result = await sync_to_async(FRIEND_ACTIONS[event_type])(friend_id, self.user_id)
        except Exception:  # an error here would close the socket, so report it instead
            log.exception("Friend action %s failed", event_type)
            result = {"status": "error", "message": "Something went wrong. Please try again."}

        if result["status"] == "error":  # only the person who tried needs to know
            await self.send(text_data=json.dumps({"type": event_type, "friend_id": friend_id, **result}))
            return

        await self.tell_both(event_type, result, friend_id)
        await sync_to_async(push_notifications)(friend_id, self.user_id)

    async def tell_both(self, event_type, result, friend_id):
        for me, other in [(self.user_id, friend_id), (friend_id, self.user_id)]:
            await self.channel_layer.group_send(
                f"user_{me}",
                {"type": event_type, "status": result["status"], "message": result["message"], "friend_id": other},
            )
            await self.channel_layer.group_send(
                f"user_{me}",
                {"type": "refresh_friend_status", "user_id": self.user_id, "friend_id": friend_id},
            )

    async def relay_typing(self, conversation_id):
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            return
        members = await sync_to_async(member_ids)(conversation_id)
        if self.user_id not in members:
            return  # only members may signal typing
        for account_id in members:
            if account_id != self.user_id:
                await self.channel_layer.group_send(
                    f"user_{account_id}",
                    {"type": "chat_typing", "conversation_id": conversation_id, "account_id": self.user_id},
                )

    async def forward(self, event):
        await self.send(text_data=json.dumps(event))

    add_friend_result = forward  # each event type the server sends goes straight to the app
    cancel_friend_request = forward
    accept_friend_result = forward
    unfriend = forward
    refresh_friend_status = forward
    chat_message = forward
    chat_message_updated = forward
    chat_read = forward
    chat_typing = forward
    chat_conversation = forward
    games_updated = forward  # a game's roster or details changed

    async def new_notification(self, event):
        await self.send(text_data=json.dumps({
            "type": "notification",
            "from_user_id": event["from_user_id"],
            "count": event["count"],
            "notifications": event["notifications"],
        }))

    async def posts_new(self, event):  # a friend posted: the app refreshes its "New posts" pill
        await self.send(text_data=json.dumps({"type": "posts_new"}))

    async def sparks_updated(self, event):  # a friend posted or deleted a spark
        await self.send(text_data=json.dumps({"type": "sparks_updated"}))

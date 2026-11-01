from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id
from notifications.queries import countNotifications, showNotificationsByUser

from . import services


def _push_notification(recipient_id, sender_id):
    """Real-time bump of the recipient's notification badge (best effort)."""
    try:
        async_to_sync(get_channel_layer().group_send)(
            f"user_{recipient_id}",
            {
                "type": "new_notification",
                "from_user_id": sender_id,
                "count": countNotifications(recipient_id),
                "notifications": showNotificationsByUser(recipient_id),
            },
        )
    except Exception as error:
        print(f"Realtime push failed: {error}")


class SendGlow(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        sender_id = current_account_id(request)
        try:
            note = services.send_glow(
                sender_id, request.data.get("recipient_id"), request.data.get("message")
            )
        except services.GlowError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        _push_notification(note["recipient_id"], sender_id)
        return Response(note, status=status.HTTP_201_CREATED)


class GlowWall(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, account_id):
        return Response(services.wall(account_id))


class GlowChain(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, note_id):
        chain = services.chain_for(note_id)
        if chain is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(chain)


class MyGlowStatus(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(services.status_for(current_account_id(request)))


class WeeklyGlows(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        return Response(services.weekly())

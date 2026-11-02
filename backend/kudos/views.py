from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id
from notifications.queries import push_notifications

from . import services


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
        push_notifications(note["recipient_id"], sender_id)
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

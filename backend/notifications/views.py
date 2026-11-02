from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id, require_self

from .queries import count_unread, list_notifications, mark_all_read


class CountNotifications(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, account_id):
        require_self(request, account_id)
        return Response(count_unread(account_id))


class ShowNotificationsByUser(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, account_id):
        require_self(request, account_id)
        return Response(list_notifications(account_id))


class MarkAllRead(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        return Response(mark_all_read(current_account_id(request)))

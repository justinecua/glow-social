from accounts.auth_utils import require_self, current_account_id
from django.shortcuts import render

# Create your views here.

from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from drf_yasg.utils import swagger_auto_schema
from rest_framework_simplejwt.tokens import RefreshToken

from .queries import (
    countNotifications,
    showNotificationsByUser,
    markAllRead,
)

class CountNotifications(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, account_id):
        require_self(request, account_id)
        data = countNotifications(account_id) 
        return Response(data)
    
class ShowNotificationsByUser(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, account_id):
        require_self(request, account_id)
        data = showNotificationsByUser(account_id) 
        return Response(data)


class MarkAllRead(APIView):
    """Mark the signed-in user's notifications as read (clears the badge)."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        return Response(markAllRead(current_account_id(request)))

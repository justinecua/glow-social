from accounts.auth_utils import require_self, current_account_id
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .queries import (
    myFriends,
    getTotalFriends,
    checkUserFriendRequest
)

class GetTotalFriends(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, account_id):
        data = getTotalFriends(account_id) 
        return Response(data)

class CheckUserFriendRequest(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, friend_id, accId):
        require_self(request, accId)
        data = checkUserFriendRequest(friend_id, accId) 
        return Response(data)


class MyFriends(APIView):
    """The signed-in user's friends and pending requests."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(myFriends(current_account_id(request)))

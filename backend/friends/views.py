from accounts.auth_utils import require_self, current_account_id
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .queries import (
    myFriends,
    getTotalFriends,
    checkUserFriendRequest,
    peopleYouMayKnow,
)


class PeopleYouMayKnow(APIView):
    """Friend suggestions for the signed-in user, by mutual friends."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(peopleYouMayKnow(current_account_id(request)))

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


class CloseFriendToggle(APIView):
    """POST adds a friend to your Close Friends list, DELETE removes them."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, account_id):
        from django.db.models import Q
        from .models import CloseFriend, Friend

        me = current_account_id(request)
        are_friends = Friend.objects.filter(
            Q(user_id=me, friend_id=account_id) | Q(user_id=account_id, friend_id=me),
            status="Friends",
        ).exists()
        if not are_friends:
            return Response(
                {"detail": "You can only add friends to Close Friends."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        CloseFriend.objects.get_or_create(owner_id=me, friend_id=account_id)
        return Response({"id": int(account_id), "is_close": True})

    def delete(self, request, account_id):
        from .models import CloseFriend

        CloseFriend.objects.filter(
            owner_id=current_account_id(request), friend_id=account_id
        ).delete()
        return Response({"id": int(account_id), "is_close": False})

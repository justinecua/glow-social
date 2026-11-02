from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id, require_self

from .queries import (
    add_close_friend,
    are_friends,
    count_friends,
    find_friendship,
    my_friends,
    people_you_may_know,
    remove_close_friend,
)


class PeopleYouMayKnow(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(people_you_may_know(current_account_id(request)))


class GetTotalFriends(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, account_id):
        return Response(count_friends(account_id))


class CheckUserFriendRequest(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, friend_id, accId):
        require_self(request, accId)
        return Response(find_friendship(accId, friend_id))


class MyFriends(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(my_friends(current_account_id(request)))


class CloseFriendToggle(APIView):  # POST adds a friend to Close Friends, DELETE removes them
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, account_id):
        me = current_account_id(request)
        if not are_friends(me, account_id):
            return Response(
                {"detail": "You can only add friends to Close Friends."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        add_close_friend(me, account_id)
        return Response({"id": account_id, "is_close": True})

    def delete(self, request, account_id):
        remove_close_friend(current_account_id(request), account_id)
        return Response({"id": account_id, "is_close": False})

from django.urls import path

from .views import CheckUserFriendRequest, CloseFriendToggle, GetTotalFriends, MyFriends, PeopleYouMayKnow

urlpatterns = [
    path("mine/", MyFriends.as_view(), name="myFriends"),
    path("suggestions/", PeopleYouMayKnow.as_view(), name="peopleYouMayKnow"),
    path("closeFriends/<int:account_id>/", CloseFriendToggle.as_view(), name="closeFriendToggle"),
    path("getTotalFriends/<int:account_id>/", GetTotalFriends.as_view(), name="getTotalFriends"),
    path("checkUserFriendRequest/<int:friend_id>/<int:accId>/", CheckUserFriendRequest.as_view(), name="check_user_friend_request"),
]

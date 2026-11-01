from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    GetTotalFriends,
    CheckUserFriendRequest,
    MyFriends,
    )

urlpatterns = [
    path('mine/', MyFriends.as_view(), name='myFriends'),
    path('getTotalFriends/<int:account_id>/', GetTotalFriends.as_view(), name='getTotalFriends'),
    path("checkUserFriendRequest/<int:friend_id>/<int:accId>/", CheckUserFriendRequest.as_view(), name="check_user_friend_request"),
]


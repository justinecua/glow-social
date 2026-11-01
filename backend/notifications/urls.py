from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    CountNotifications,
    ShowNotificationsByUser,
    MarkAllRead,
)


urlpatterns = [
    path("countNotifications/<int:account_id>/", CountNotifications.as_view(), name="countNotifications"),
    path("showNotificationsByUser/<int:account_id>/", ShowNotificationsByUser.as_view(), name="showNotificationsByUser"),
    path("markAllRead/", MarkAllRead.as_view(), name="markAllRead"),
 
]

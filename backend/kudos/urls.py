from django.urls import path

from .views import GlowChain, GlowWall, MyGlowStatus, SendGlow, WeeklyGlows

urlpatterns = [
    path("send/", SendGlow.as_view(), name="sendGlowNote"),
    path("wall/<int:account_id>/", GlowWall.as_view(), name="glowWall"),
    path("chain/<int:note_id>/", GlowChain.as_view(), name="glowChain"),
    path("me/", MyGlowStatus.as_view(), name="myGlowStatus"),
    path("weekly/", WeeklyGlows.as_view(), name="weeklyGlows"),
]

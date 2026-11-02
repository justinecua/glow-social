from django.urls import path

from .views import GameDetail, JoinGame

urlpatterns = [
    path("<int:game_id>/", GameDetail.as_view(), name="gameDetail"),
    path("<int:game_id>/join/", JoinGame.as_view(), name="joinGame"),
]

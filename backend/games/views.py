from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id

from . import queries
from .queries import GameError


def not_found():
    return Response({"detail": "Game not found."}, status=status.HTTP_404_NOT_FOUND)


def bad_request(error):
    return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)


class GameDetail(APIView):  # GET the game and roster, PATCH edits it (host only)
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, game_id):
        me = current_account_id(request)
        if not queries.find_visible_game(game_id, me):
            return not_found()
        return Response(queries.detail(game_id, me))

    def patch(self, request, game_id):
        me = current_account_id(request)
        game = queries.find_game(game_id)
        if not game or game["host_id"] != me:
            return not_found()
        try:
            queries.update(game, me, request.data)
        except GameError as e:
            return bad_request(e)
        return Response(queries.detail(game_id, me))


class JoinGame(APIView):  # POST joins (or waitlists), DELETE leaves
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, game_id):
        me = current_account_id(request)
        if not queries.find_visible_game(game_id, me):
            return not_found()
        try:
            queries.join(game_id, me)
        except GameError as e:
            return bad_request(e)
        return Response(queries.detail(game_id, me))

    def delete(self, request, game_id):
        me = current_account_id(request)
        if not queries.find_game(game_id):
            return not_found()
        try:
            queries.leave(game_id, me)
        except GameError as e:
            return bad_request(e)
        return Response(queries.detail(game_id, me))

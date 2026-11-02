from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id

from .queries import (
    ChatError,
    addMembers,
    deleteMessage,
    editMessage,
    getConversation,
    leaveConversation,
    listConversations,
    listMessages,
    markRead,
    renameGroup,
    sendMessage,
    startConversation,
    unreadTotal,
)


def respond(query, *args, ok_status=status.HTTP_200_OK):
    """Run a query and send its result, or its error message and status."""
    try:
        return Response(query(*args), status=ok_status)
    except ChatError as error:
        return Response({"detail": str(error)}, status=error.status)


class Conversations(APIView):
    """GET your inbox · POST {member_ids, title?} to start a chat."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return respond(listConversations, current_account_id(request))

    def post(self, request):
        try:
            data, created = startConversation(
                current_account_id(request),
                request.data.get("member_ids"),
                request.data.get("title", ""),
            )
        except ChatError as error:
            return Response({"detail": str(error)}, status=error.status)
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ConversationDetail(APIView):
    """GET details · PATCH {title} to rename a group."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, conversation_id):
        return respond(getConversation, conversation_id, current_account_id(request))

    def patch(self, request, conversation_id):
        return respond(renameGroup, conversation_id, current_account_id(request),
                       request.data.get("title", ""))


class ConversationMessages(APIView):
    """GET ?before=<id> (older page) · POST {body} to send."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, conversation_id):
        before = request.query_params.get("before")
        before = int(before) if before and before.isdigit() else None
        return respond(listMessages, conversation_id, current_account_id(request), before)

    def post(self, request, conversation_id):
        return respond(sendMessage, conversation_id, current_account_id(request),
                       request.data.get("body"), ok_status=status.HTTP_201_CREATED)


class ConversationRead(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, conversation_id):
        return respond(markRead, conversation_id, current_account_id(request))


class ConversationMembers(APIView):
    """POST {member_ids} to add friends to a group · DELETE to leave it."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, conversation_id):
        return respond(addMembers, conversation_id, current_account_id(request),
                       request.data.get("member_ids"))

    def delete(self, request, conversation_id):
        return respond(leaveConversation, conversation_id, current_account_id(request))


class MessageDetail(APIView):
    """PATCH {body} to edit your message · DELETE to delete it."""
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, message_id):
        return respond(editMessage, message_id, current_account_id(request),
                       request.data.get("body"))

    def delete(self, request, message_id):
        return respond(deleteMessage, message_id, current_account_id(request))


class UnreadCount(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response({"unread": unreadTotal(current_account_id(request))})

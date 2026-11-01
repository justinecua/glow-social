from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id

from . import services


def _run(fn, *args, ok_status=status.HTTP_200_OK):
    try:
        result = fn(*args)
    except services.ChatError as e:
        return Response({"detail": str(e)}, status=e.status)
    return Response(result, status=ok_status)


class Conversations(APIView):
    """GET your inbox · POST {member_ids, title?} to start a chat."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(services.list_conversations(current_account_id(request)))

    def post(self, request):
        try:
            data, created = services.start_conversation(
                current_account_id(request),
                request.data.get("member_ids"),
                request.data.get("title", ""),
            )
        except services.ChatError as e:
            return Response({"detail": str(e)}, status=e.status)
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ConversationDetail(APIView):
    """GET details · PATCH {title} to rename a group."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, conversation_id):
        return _run(services.get_conversation, conversation_id, current_account_id(request))

    def patch(self, request, conversation_id):
        return _run(services.rename_group, conversation_id, current_account_id(request),
                    request.data.get("title", ""))


class ConversationMessages(APIView):
    """GET ?before=<id> (older page) · POST {body} to send."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, conversation_id):
        before = request.query_params.get("before")
        try:
            before = int(before) if before else None
        except ValueError:
            before = None
        return _run(services.list_messages, conversation_id, current_account_id(request), before)

    def post(self, request, conversation_id):
        return _run(services.send_message, conversation_id, current_account_id(request),
                    request.data.get("body"), ok_status=status.HTTP_201_CREATED)


class ConversationRead(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, conversation_id):
        return _run(services.mark_read, conversation_id, current_account_id(request))


class ConversationMembers(APIView):
    """POST {member_ids} to add friends to a group · DELETE to leave it."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, conversation_id):
        return _run(services.add_members, conversation_id, current_account_id(request),
                    request.data.get("member_ids"))

    def delete(self, request, conversation_id):
        return _run(services.leave, conversation_id, current_account_id(request))


class MessageDetail(APIView):
    """PATCH {body} to edit your message · DELETE to delete it."""
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, message_id):
        return _run(services.edit_message, message_id, current_account_id(request),
                    request.data.get("body"))

    def delete(self, request, message_id):
        return _run(services.delete_message, message_id, current_account_id(request))


class UnreadCount(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response({"unread": services.unread_total(current_account_id(request))})

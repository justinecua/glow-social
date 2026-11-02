from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id
from posts.visibility import can_view_post, viewer_account_id

from .api.decorators import show_comments_decorator
from .queries import CommentError, add_comment, delete_comment, edit_comment, list_comments

POST_NOT_FOUND = {"detail": "Post not found."}


def as_id(value):  # ids from a request body arrive as text or numbers; anything else is invalid
    return int(value) if str(value).isdigit() else None


class ShowComments(APIView):
    permission_classes = (permissions.AllowAny,)

    @show_comments_decorator()
    def get(self, request, post_id):
        if not can_view_post(post_id, viewer_account_id(request)):
            return Response(POST_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(list_comments(post_id))


class AddComment(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        me = current_account_id(request)
        post_id = as_id(request.data.get("postId"))
        if not post_id or not can_view_post(post_id, me):
            return Response(POST_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        try:
            data = add_comment(request.data.get("comment"), post_id, me, as_id(request.data.get("parentId")))
        except CommentError as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_201_CREATED)


class CommentDetail(APIView):  # PATCH edits your comment; DELETE removes yours, or any on your post
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, comment_id):
        try:
            comment = edit_comment(comment_id, current_account_id(request), request.data.get("comment"))
        except CommentError as e:
            return Response({"status": 400, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if not comment:
            return Response({"status": 404, "message": "Comment not found or not yours."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"status": 200, "comment": comment})

    def delete(self, request, comment_id):
        deleted_ids = delete_comment(comment_id, current_account_id(request))
        if not deleted_ids:
            return Response(
                {"status": 404, "message": "Comment not found or you can't delete it."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"status": 200, "deleted_ids": deleted_ids})

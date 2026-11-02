from posts.visibility import can_view_post, viewer_account_id
from accounts.auth_utils import current_account_id

from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from drf_yasg.utils import swagger_auto_schema
from rest_framework_simplejwt.tokens import RefreshToken

from .queries import (
    countGlows,
    getProfileGlows,
    countComments,
    showComments,
    addComment,
    editComment,
    deleteComment,
)

from .api.decorators import (
    count_glows_decorator,
    get_profile_glows_decorator,
    count_comments_decorator,
    show_comments_decorator
)


class CountGlows(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @count_glows_decorator()
    def get(self, request):
        post_id = request.data.get("post_id") 

        data = countGlows(post_id) 
        return Response(data)

class GetProfileGlows(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @get_profile_glows_decorator()
    def get(self, request):
        post_id = request.data.get("post_id") 

        data = getProfileGlows(post_id) 
        return Response(data)

class CountComments(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @count_comments_decorator()
    def get(self, request):
        post_id = request.data.get("post_id") 

        data = countComments(post_id) 
        return Response(data)

class ShowComments(APIView):
    permission_classes = (permissions.AllowAny,)

    @show_comments_decorator()
    def get(self, request, post_id):
        if not can_view_post(post_id, viewer_account_id(request)):
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)
        data = showComments(post_id)
        return Response(data)

class AddComment(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        comment = request.data.get("comment")
        accID = current_account_id(request)  # ignore client-sent accID
        postId = request.data.get("postId")
        if not can_view_post(postId, accID):
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)
        parentId = request.data.get("parentId")

        if not comment or not str(comment).strip():
            return Response(
                {"status": "error", "message": "Comment cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = addComment(str(comment).strip(), postId, accID, parentId)
        if data.get("status") != "success":
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_201_CREATED)
    

class CommentDetail(APIView):
    """PATCH to edit your comment; DELETE to remove your comment (or any
    comment on your own post)."""
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, comment_id):
        data = editComment(comment_id, current_account_id(request), request.data.get("comment"))
        return Response(data, status=data["status"])

    def delete(self, request, comment_id):
        data = deleteComment(comment_id, current_account_id(request))
        return Response(data, status=data["status"])

from django.urls import path

from .views import AddComment, CommentDetail, ShowComments

urlpatterns = [
    path("showComments/<int:post_id>/", ShowComments.as_view(), name="showComments"),
    path("addComment/", AddComment.as_view(), name="addComment"),
    path("comment/<int:comment_id>/", CommentDetail.as_view(), name="commentDetail"),
]

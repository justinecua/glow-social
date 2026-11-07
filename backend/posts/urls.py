from django.urls import path

from .views import (
    CreatePost,
    Explore,
    GetPost,
    GetPosts,
    GetPostsByUser,
    LinkPreview,
    MarkSeen,
    NewPostsSince,
    PostDetail,
    ReportPost,
    Search,
    SendGlow,
    SendUnglow,
    TodayPrompt,
    VotePoll,
)

urlpatterns = [
    path("linkPreview/", LinkPreview.as_view(), name="linkPreview"),
    path("getPosts/", GetPosts.as_view(), name="getPosts"),
    path("new/", NewPostsSince.as_view(), name="newPostsSince"),
    path("seen/", MarkSeen.as_view(), name="markSeen"),
    path("<int:post_id>/vote/", VotePoll.as_view(), name="votePoll"),
    path("prompt/today/", TodayPrompt.as_view(), name="todayPrompt"),
    path("explore/", Explore.as_view(), name="explore"),
    path("search/", Search.as_view(), name="search"),
    path("post/<str:code>/", GetPost.as_view(), name="getPost"),
    path("post/<int:post_id>/manage/", PostDetail.as_view(), name="managePost"),
    path("post/<int:post_id>/report/", ReportPost.as_view(), name="reportPost"),
    path("createPost/", CreatePost.as_view(), name="createPost"),
    path("sendGlow/", SendGlow.as_view(), name="sendGlow"),
    path("sendUnglow/", SendUnglow.as_view(), name="sendUnglow"),
    path("getPostsByUser/<int:account_id>/", GetPostsByUser.as_view(), name="getPostsByUser"),
]

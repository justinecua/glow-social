from django.urls import path

from . import views

urlpatterns = [
    path("conversations/", views.Conversations.as_view(), name="conversations"),
    path("conversations/<int:conversation_id>/", views.ConversationDetail.as_view(), name="conversation"),
    path("conversations/<int:conversation_id>/messages/", views.ConversationMessages.as_view(), name="conversationMessages"),
    path("conversations/<int:conversation_id>/read/", views.ConversationRead.as_view(), name="conversationRead"),
    path("conversations/<int:conversation_id>/members/", views.ConversationMembers.as_view(), name="conversationMembers"),
    path("messages/<int:message_id>/", views.MessageDetail.as_view(), name="messageDetail"),
    path("unread/", views.UnreadCount.as_view(), name="unreadMessages"),
]

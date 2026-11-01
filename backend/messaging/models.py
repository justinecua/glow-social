from django.db import models

from accounts.models import Account


class Conversation(models.Model):
    """A 1:1 chat (is_group=False, exactly two members) or a group chat."""

    MAX_GROUP_MEMBERS = 20

    is_group = models.BooleanField(default=False)
    title = models.CharField(max_length=60, blank=True, default="")
    created_by = models.ForeignKey(
        Account, null=True, on_delete=models.SET_NULL, related_name="conversations_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Bumped on every message so the inbox can sort by recent activity.
    updated_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return self.title or f"Conversation {self.pk}"


class ConversationMember(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="members")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="conversation_memberships")
    joined_at = models.DateTimeField(auto_now_add=True)
    # Messages after this are unread; also drives "Seen" receipts.
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("conversation", "account")
        indexes = [models.Index(fields=["account", "conversation"])]


class Message(models.Model):
    MAX_LENGTH = 2000

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="messages_sent")
    body = models.TextField(max_length=MAX_LENGTH)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    # Soft delete: keeps the thread's shape ("Message deleted") without the text.
    is_deleted = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["conversation", "-id"])]

    def __str__(self):
        return f"{self.sender_id}: {self.body[:40]}"

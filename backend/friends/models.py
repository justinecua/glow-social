from django.db import models

from accounts.models import Account


class Friend(models.Model):
    PENDING = "Pending"
    FRIENDS = "Friends"
    REJECTED = "Rejected"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (FRIENDS, "Friends"),
        (REJECTED, "Rejected"),
    ]

    user = models.ForeignKey(Account, related_name='user_friendships', on_delete=models.CASCADE)
    friend = models.ForeignKey(Account, related_name='friend_friendships', on_delete=models.CASCADE)
    status = models.CharField(max_length=100, choices=STATUS_CHOICES, default=PENDING)
    date_friend_request = models.DateTimeField(auto_now_add=True, null=True)
    date_became_friends = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'friend')
        indexes = [
            models.Index(fields=["user", "status"], name="friend_user_status_idx"),  # "who are X's friends?"
            models.Index(fields=["friend", "status"], name="friend_friend_status_idx"),  # checks both directions
        ]

    def __str__(self):
        return f"{self.user_id} -> {self.friend_id} ({self.status})"


class CloseFriend(models.Model):  # `owner` put `friend` on their Close Friends list
    owner = models.ForeignKey(Account, related_name="close_friends", on_delete=models.CASCADE)
    friend = models.ForeignKey(Account, related_name="close_friend_of", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("owner", "friend")

    def __str__(self):
        return f"{self.owner_id} -> {self.friend_id} (close friend)"

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
    
    def __str__(self):
        return f"{self.user.firstname} sent a friend request to {self.friend.firstname}"


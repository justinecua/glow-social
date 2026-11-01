from django.db import models
from accounts.models import Account

class NotificationType(models.Model):
    type = models.CharField(max_length=255)  # e.g. friend_request, comment, glow

    def __str__(self):
        return self.type

class Notification(models.Model):
    UNREAD = "Unread"
    READ = "Read"
    STATUS_CHOICES = [
        (UNREAD, "Unread"),
        (READ, "Read"),
    ]

    status = models.CharField(max_length=100, choices=STATUS_CHOICES, default=UNREAD)
    notif_type = models.ForeignKey(NotificationType, null=True, on_delete=models.CASCADE)
    notif_to = models.ForeignKey(Account, null=True, related_name="notifications", on_delete=models.CASCADE)
    notif_from = models.ForeignKey(Account, null=True, related_name="sent_notifications", on_delete=models.CASCADE)
    content = models.CharField(max_length=1000)  
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return self.content

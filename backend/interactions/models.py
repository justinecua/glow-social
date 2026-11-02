from django.db import models

from accounts.models import Account
from posts.models import Audience, Post


class Comment(models.Model):
    content = models.CharField(max_length=255, default="")
    dateTime = models.DateTimeField(auto_now_add=True, null=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    account = models.ForeignKey(Account, on_delete=models.CASCADE)
    parent = models.ForeignKey(  # replies point at a top-level comment; threads are one level deep
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="replies",
    )
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["account", "dateTime"], name="comment_author_time_idx"),  # feed: what you commented on lately
        ]

    def __str__(self):
        return self.content


class Glow(models.Model):
    account = models.ForeignKey(Account, null=True, on_delete=models.CASCADE)
    post = models.ForeignKey(Post, null=True, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["account", "post"], name="glow_one_per_account_post"),
        ]
        indexes = [
            models.Index(fields=["account", "timestamp"], name="glow_author_time_idx"),  # feed: what you glowed lately
        ]

    def __str__(self):
        return f"{self.account_id} glowed post {self.post_id}"


class Share(models.Model):
    account = models.ForeignKey(Account, null=True, on_delete=models.CASCADE)
    audience = models.ForeignKey(Audience, null=True, on_delete=models.CASCADE)
    caption = models.CharField(max_length=800, blank=True, default="")
    post = models.ForeignKey(Post, null=True, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return f"{self.account_id} shared post {self.post_id}"

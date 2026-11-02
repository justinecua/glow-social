from datetime import timedelta

from django.db import models
from django.utils import timezone

from accounts.models import Account

SPARK_LIFETIME = timedelta(hours=24)


def _expiry():
    return timezone.now() + SPARK_LIFETIME


class Spark(models.Model):
    """A photo or text moment that disappears after 24 hours. Visible to the
    author's friends, or only their Close Friends."""

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="sparks")
    photo = models.URLField(max_length=500, blank=True, default="")
    text = models.CharField(max_length=200, blank=True, default="")
    background = models.CharField(max_length=20, blank=True, default="")  # text sparks
    close_friends_only = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(default=_expiry, db_index=True)

    class Meta:
        ordering = ["created_at"]
        # The timeline asks for "unexpired sparks by these authors".
        indexes = [models.Index(fields=["account", "expires_at"], name="spark_author_expiry")]

    def __str__(self):
        return f"Spark {self.id} by {self.account_id}"


class SparkView(models.Model):
    spark = models.ForeignKey(Spark, on_delete=models.CASCADE, related_name="views")
    account = models.ForeignKey(Account, on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("spark", "account")


class SparkWarm(models.Model):
    """A viewer held down on a spark to "warm" it (a quiet reaction)."""

    spark = models.ForeignKey(Spark, on_delete=models.CASCADE, related_name="warms")
    account = models.ForeignKey(Account, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("spark", "account")

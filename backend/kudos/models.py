from django.db import models

from accounts.models import Account


class GlowNote(models.Model):
    """A short note of appreciation sent from one person to another.

    `passed_from` links to the glow the sender had received and is now
    paying forward; following those links backwards gives the chain
    (Ana -> Geo -> Mark -> you).
    """

    MAX_LENGTH = 140

    sender = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="glow_notes_sent"
    )
    recipient = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="glow_notes_received"
    )
    message = models.CharField(max_length=MAX_LENGTH)
    passed_from = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="passed_on",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Moderation: hidden notes disappear from walls, chains and stats.
    is_hidden = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["sender", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.sender_id} -> {self.recipient_id}: {self.message[:40]}"

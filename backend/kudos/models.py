from django.db import models

from accounts.models import Account


class GlowNote(models.Model):  # a short thank-you note from one person to another
    MAX_LENGTH = 140

    sender = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="glow_notes_sent"
    )
    recipient = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="glow_notes_received"
    )
    message = models.CharField(max_length=MAX_LENGTH)
    passed_from = models.ForeignKey(  # the kudos the sender got and is paying forward; links form the chain
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="passed_on",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_hidden = models.BooleanField(default=False)  # moderation: hidden from walls, chains and stats

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["sender", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.sender_id} -> {self.recipient_id}: {self.message[:40]}"

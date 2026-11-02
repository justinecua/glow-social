from django.db import models

from accounts.models import Account
from posts.models import Post


class PlaySession(models.Model):  # an open-play game people join, shared as a post
    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name="game")
    host = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="hosted_games")
    title = models.CharField(max_length=100)
    venue = models.CharField(max_length=150)
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    level_min = models.CharField(max_length=4, blank=True, default="")  # e.g. "3.0"
    level_max = models.CharField(max_length=4, blank=True, default="")
    capacity = models.PositiveSmallIntegerField(default=8)
    courts = models.PositiveSmallIntegerField(default=1)
    court_url = models.URLField(max_length=500, blank=True, default="")  # booking page, e.g. Courtogo
    maps_url = models.URLField(max_length=500, blank=True, default="")
    court_booked = models.BooleanField(default=False)
    notes = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.starts_at:%Y-%m-%d})"


class PlaySessionPlayer(models.Model):
    JOINED = "joined"
    WAITLIST = "waitlist"

    session = models.ForeignKey(PlaySession, on_delete=models.CASCADE, related_name="players")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="games_joined")
    status = models.CharField(max_length=10, default=JOINED)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("session", "account")
        indexes = [models.Index(fields=["account", "status"], name="game_player_account_status")]

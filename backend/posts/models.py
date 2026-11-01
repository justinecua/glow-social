from django.db import models
from accounts.models import Account

class Audience(models.Model):
    """Who can see a post. `key` is what code uses:
    public · friends · close_friends · only_me."""
    key = models.SlugField(max_length=30, unique=True, null=True, blank=True)
    audience = models.CharField(max_length=150, default="")
    description = models.CharField(max_length=255, default="")
    link = models.URLField(verbose_name="File URL", blank=True, default="")

    def __str__(self):
        return self.audience

class Post(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE)
    audience = models.ForeignKey(Audience, null=True, on_delete=models.CASCADE)
    caption = models.CharField(max_length=800, blank=True, default="")
    dateTime = models.DateTimeField(auto_now_add=True, null=True)
    # Kept in sync by Postgres triggers on interactions_glow / _comment
    # (see posts/migrations/0011_post_counters.py). Read these instead of
    # COUNT()-ing glows/comments per post. `manage.py recount_posts` repairs drift.
    glow_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            # Feed / explore / "new posts" filter and sort by time.
            models.Index(fields=["-dateTime"], name="post_datetime_idx"),
            # A profile's posts, newest first.
            models.Index(fields=["account", "-dateTime"], name="post_author_datetime_idx"),
        ]

    def __str__(self):
        return self.caption

class Photo(models.Model):
    link = models.URLField(verbose_name="File URL", default="")
    link_id_imagekit = models.CharField(max_length=355, null=True, blank=True, default="")
    post = models.ForeignKey(Post, null=True, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.link}"

class Video(models.Model):
    link = models.URLField(verbose_name="File URL", default="")
    post = models.ForeignKey(Post, null=True, on_delete=models.CASCADE)

    def __str__(self):
        return self.link

class Tag(models.Model):
    tag = models.CharField(max_length=500, default="")
    post = models.ManyToManyField(Post, related_name='tags')

    def __str__(self):
        return self.tag


class PostSeen(models.Model):
    """A post that appeared on someone's screen in the feed. The feed ranks
    already-seen posts lower, like Instagram/Facebook do, so each visit
    shows something new."""
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="seen_posts")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="seen_by")
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    views = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("account", "post")
        indexes = [models.Index(fields=["account", "last_seen"])]


class Poll(models.Model):
    """A poll attached to a post: 2-4 options, one vote per person."""
    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name="poll")
    ends_at = models.DateTimeField()
    # Trivia-style polls reveal which option is right once you've voted.
    correct_option = models.ForeignKey(
        "PollOption", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    def __str__(self):
        return f"Poll on post {self.post_id}"


class PollOption(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="options")
    text = models.CharField(max_length=80)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.text


class PollVote(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="votes")
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name="votes")
    account = models.ForeignKey(Account, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("poll", "account")

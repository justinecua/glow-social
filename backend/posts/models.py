from django.db import models

from accounts.models import Account


class Audience(models.Model):  # who can see a post
    key = models.SlugField(max_length=30, unique=True, null=True, blank=True)  # public, friends, close_friends, only_me
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
    glow_count = models.PositiveIntegerField(default=0)  # kept in sync by database triggers (migration 0011)
    comment_count = models.PositiveIntegerField(default=0)  # `manage.py recount_posts` repairs any drift
    code = models.CharField(max_length=11, unique=True, editable=False)  # public id for links, like YouTube's; the database fills it (migration 0014)

    class Meta:
        indexes = [
            models.Index(fields=["-dateTime"], name="post_datetime_idx"),  # feed, explore, "new posts"
            models.Index(fields=["account", "-dateTime"], name="post_author_datetime_idx"),  # a profile's posts
        ]

    def __str__(self):
        return self.caption


class Photo(models.Model):
    link = models.URLField(verbose_name="File URL", default="")
    post = models.ForeignKey(Post, null=True, on_delete=models.CASCADE)

    def __str__(self):
        return self.link


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


class PostSeen(models.Model):  # a post was on someone's screen; the feed ranks seen posts lower
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="seen_posts")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="seen_by")
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    views = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("account", "post")
        indexes = [models.Index(fields=["account", "last_seen"])]


class Poll(models.Model):  # 2-4 options, one vote per person
    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name="poll")
    ends_at = models.DateTimeField()
    correct_option = models.ForeignKey(  # quizzes reveal the right option once you've voted
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


class PostReport(models.Model):  # someone flagged a post; the owner reviews with `manage.py reports`
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    reporter = models.ForeignKey(Account, on_delete=models.CASCADE)
    reason = models.CharField(max_length=20)  # one of posts.reports.REASONS
    created_at = models.DateTimeField()

    class Meta:
        unique_together = ("post", "reporter")  # one report per person per post

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

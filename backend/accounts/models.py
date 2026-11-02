from django.conf import settings
from django.db import models


class Account(models.Model):
    firstname = models.CharField(max_length=255, blank=True, default="")
    lastname = models.CharField(max_length=255, blank=True, default="")
    gender = models.CharField(max_length=75, blank=True, default="")
    age = models.IntegerField(null=True)
    birthday = models.DateField(null=True, blank=True)
    bio = models.CharField(max_length=255, blank=True, default="")
    ui_appearance = models.CharField(max_length=255, blank=True, default="")
    cover_photo = models.URLField(verbose_name="File URL", blank=True, default="")
    profile_photo = models.URLField(verbose_name="File URL", blank=True, null=True, default=None)
    auth_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.CASCADE)
    last_activity = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    is_bot = models.BooleanField(default=False)  # automated account, ranked below real people

    terms_version = models.CharField(max_length=32, blank=True, default="")  # which Terms they agreed to
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    marketing_opt_in = models.BooleanField(default=False)
    marketing_opt_in_at = models.DateTimeField(null=True, blank=True)

    invited_by = models.ForeignKey(  # from /invite/<username>
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invitees",
    )

    def __str__(self):
        return f"{self.firstname} {self.lastname}"


class PasswordReset(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token = models.TextField()
    expires_at = models.DateTimeField()

    def __str__(self):
        return f"Password reset token for {self.user.username}"


class ProfileDesign(models.Model):  # how someone styled their profile page; only `published` is shown to visitors
    account = models.OneToOneField(Account, on_delete=models.CASCADE, related_name="design")
    published = models.JSONField(default=dict)
    draft = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

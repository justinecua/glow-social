from django.db import models
from django.conf import settings

class Account(models.Model):
    firstname = models.CharField(max_length=255, blank=True, default="")
    lastname = models.CharField(max_length=255, blank=True, default="")
    gender = models.CharField(max_length=75, blank=True, default="")
    age = models.IntegerField(null=True)
    birthday = models.DateField(null=True, blank=True)
    bio = models.CharField(max_length=255, blank=True, default="")
    ui_appearance = models.CharField(max_length=255, blank=True, default="")
    cover_photo = models.URLField(verbose_name="File URL", blank=True, default="")
    cover_photo_id_imagekit = models.CharField(max_length=355, null=True, blank=True, default="")
    profile_photo = models.URLField(verbose_name="File URL", blank=True, null=True, default=None)
    profile_photo_id_imagekit = models.CharField(max_length=355, null=True, blank=True, default="")
    auth_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.CASCADE)
    last_activity = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    # Automated account (e.g. @glow_trends). Shown with an "Automated" badge
    # and ranked lower in the feed than real people.
    is_bot = models.BooleanField(default=False)

    # Legal consent records. Kept so we can show *when* a user agreed to
    # *which* version of the Terms/Privacy Policy, and their marketing choice.
    terms_version = models.CharField(max_length=32, blank=True, default="")
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    marketing_opt_in = models.BooleanField(default=False)
    marketing_opt_in_at = models.DateTimeField(null=True, blank=True)

    # Who invited this person (via /invite/<username>), for growth tracking.
    invited_by = models.ForeignKey(
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

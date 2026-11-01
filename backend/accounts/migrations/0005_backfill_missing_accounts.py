from datetime import timedelta

from django.conf import settings
from django.db import migrations
from django.utils import timezone


def backfill(apps, schema_editor):
    # Every auth user needs an Account row to use the app.
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    Account = apps.get_model("accounts", "Account")
    for user in User.objects.filter(account__isnull=True):
        Account.objects.create(
            auth_user=user,
            firstname=user.first_name or user.username,
            lastname=user.last_name,
        )

    # Clear "online" flags left over from sessions that never disconnected.
    cutoff = timezone.now() - timedelta(days=1)
    Account.objects.filter(is_online=True, last_activity__lt=cutoff).update(is_online=False)
    Account.objects.filter(is_online=True, last_activity__isnull=True).update(is_online=False)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_alter_account_profile_photo"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]

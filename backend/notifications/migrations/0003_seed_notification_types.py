from django.db import migrations

# friends/queries.py looks up "friend_request" and fails when it's missing.
TYPES = ["friend_request", "comment", "glow", "share"]


def seed(apps, schema_editor):
    NotificationType = apps.get_model("notifications", "NotificationType")
    for name in TYPES:
        if not NotificationType.objects.filter(type=name).exists():
            NotificationType.objects.create(type=name)


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0002_notificationtype_remove_notification_friend_request_and_more"),
    ]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]

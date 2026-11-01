# Unread badge count and the newest-first list, per person.
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models


class Migration(migrations.Migration):
    atomic = False

    dependencies = [("notifications", "0005_seed_glow_and_invite_types")]

    operations = [
        AddIndexConcurrently(
            model_name="notification",
            index=models.Index(fields=["notif_to", "status"], name="notif_to_status_idx"),
        ),
        AddIndexConcurrently(
            model_name="notification",
            index=models.Index(fields=["notif_to", "-created_at"], name="notif_to_created_idx"),
        ),
    ]

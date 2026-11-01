from django.db import migrations


def normalize(apps, schema_editor):
    # "confirmed" isn't one of Notification.STATUS_CHOICES (Unread/Read).
    Notification = apps.get_model("notifications", "Notification")
    Notification.objects.filter(status="confirmed").update(status="Read")


class Migration(migrations.Migration):
    dependencies = [("notifications", "0003_seed_notification_types")]

    operations = [migrations.RunPython(normalize, migrations.RunPython.noop)]

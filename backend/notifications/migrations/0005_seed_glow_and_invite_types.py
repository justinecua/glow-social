from django.db import migrations

TYPES = ["glow_note", "invite_joined"]


def seed(apps, schema_editor):
    NotificationType = apps.get_model("notifications", "NotificationType")
    for name in TYPES:
        NotificationType.objects.get_or_create(type=name)


class Migration(migrations.Migration):
    dependencies = [("notifications", "0004_normalize_status")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]

from django.db import migrations


def normalize(apps, schema_editor):
    # friends/queries.py matches status exactly, so lowercase rows were invisible.
    Friend = apps.get_model("friends", "Friend")
    Friend.objects.filter(status="pending").update(status="Pending")


class Migration(migrations.Migration):
    dependencies = [("friends", "0002_alter_friend_unique_together")]

    operations = [migrations.RunPython(normalize, migrations.RunPython.noop)]

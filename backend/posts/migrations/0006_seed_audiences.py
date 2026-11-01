from django.db import migrations

# key -> (display name, description). Existing rows are matched by their
# current name so their ids (and every post's audience) stay the same.
AUDIENCES = {
    "public": ("Public", "Anyone can see this", ["Public"]),
    "friends": ("Friends", "Your friends can see this", ["Followers", "Friends"]),
    "close_friends": ("Close friends", "Only people on your Close Friends list", ["Close friends"]),
    "only_me": ("Only me", "Only you can see this", ["Private", "Only me"]),
}


def seed(apps, schema_editor):
    from django.core.management.color import no_style

    Audience = apps.get_model("posts", "Audience")
    # Rows inserted with explicit ids (fixtures/manual SQL) leave the id
    # sequence behind, so creating "Close friends" would reuse id 1. Resync it.
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        for sql in connection.ops.sequence_reset_sql(no_style(), [Audience]):
            cursor.execute(sql)
    for key, (name, description, old_names) in AUDIENCES.items():
        row = (
            Audience.objects.filter(key=key).first()
            or Audience.objects.filter(audience__in=old_names).order_by("id").first()
        )
        if row is None:
            row = Audience()
        row.key = key
        row.audience = name
        row.description = description
        row.save()


class Migration(migrations.Migration):
    dependencies = [("posts", "0005_audience_key")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]

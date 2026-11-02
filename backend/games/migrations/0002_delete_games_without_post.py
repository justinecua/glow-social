from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("games", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(  # games made before they were tied to posts can't get a post_id
            sql=[
                "DELETE FROM glow.glow.games_playsessionplayer",
                "DELETE FROM glow.glow.games_playsession",
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

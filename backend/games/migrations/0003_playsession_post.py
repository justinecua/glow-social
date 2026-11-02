from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("games", "0002_delete_games_without_post"),
        ("posts", "0013_remove_photo_link_id_imagekit"),
    ]

    operations = [
        migrations.AddField(
            model_name="playsession",
            name="post",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="game",
                to="posts.post",
                default=None,
            ),
            preserve_default=False,
        ),
    ]

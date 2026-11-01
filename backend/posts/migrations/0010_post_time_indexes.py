# Indexes for the feed, explore, "new posts" check and profiles.
# Built CONCURRENTLY so a large posts table stays readable/writable.
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models


class Migration(migrations.Migration):
    atomic = False  # required for CREATE INDEX CONCURRENTLY

    dependencies = [("posts", "0009_polls")]

    operations = [
        AddIndexConcurrently(
            model_name="post",
            index=models.Index(fields=["-dateTime"], name="post_datetime_idx"),
        ),
        AddIndexConcurrently(
            model_name="post",
            index=models.Index(fields=["account", "-dateTime"], name="post_author_datetime_idx"),
        ),
    ]

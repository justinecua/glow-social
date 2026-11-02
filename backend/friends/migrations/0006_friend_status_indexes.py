# Friend lookups check both sides of a pair, filtered by status.
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models


class Migration(migrations.Migration):
    atomic = False

    dependencies = [("friends", "0005_close_friend")]

    operations = [
        AddIndexConcurrently(
            model_name="friend",
            index=models.Index(fields=["user", "status"], name="friend_user_status_idx"),
        ),
        AddIndexConcurrently(
            model_name="friend",
            index=models.Index(fields=["friend", "status"], name="friend_friend_status_idx"),
        ),
    ]

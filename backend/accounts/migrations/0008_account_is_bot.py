from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_account_invited_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="account",
            name="is_bot",
            field=models.BooleanField(default=False),
        ),
    ]

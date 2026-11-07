from django.db import migrations, models

NEW_CODE = "translate(substr(encode(uuid_send(gen_random_uuid()), 'base64'), 1, 11), '+/', '-_')"  # 11 random URL-safe characters

SQL = f"""
ALTER TABLE posts_post ADD COLUMN code varchar(11);
UPDATE posts_post SET code = {NEW_CODE};  -- every existing post gets its own random code
ALTER TABLE posts_post ALTER COLUMN code SET DEFAULT {NEW_CODE};  -- raw INSERTs get one too, without listing the column
ALTER TABLE posts_post ALTER COLUMN code SET NOT NULL;
ALTER TABLE posts_post ADD CONSTRAINT posts_post_code_key UNIQUE (code);
"""
REVERSE = "ALTER TABLE posts_post DROP COLUMN code;"


class Migration(migrations.Migration):
    dependencies = [("posts", "0013_remove_photo_link_id_imagekit")]
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(SQL, REVERSE)],
            state_operations=[
                migrations.AddField(
                    model_name="post",
                    name="code",
                    field=models.CharField(max_length=11, unique=True, editable=False),
                    preserve_default=False,
                ),
            ],
        ),
    ]

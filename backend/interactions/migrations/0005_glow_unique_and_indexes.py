# One glow per (account, post), plus indexes for the feed's affinity step.
#
# Order matters on a live table:
#   1. delete existing duplicate glows (keep the oldest of each pair),
#   2. build the unique index CONCURRENTLY (no long write lock),
#   3. attach it as a named constraint (instant), so
#      INSERT ... ON CONFLICT ON CONSTRAINT glow_one_per_account_post works.
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models

DEDUPE = """
DELETE FROM interactions_glow g
USING interactions_glow keep
WHERE g.account_id = keep.account_id
  AND g.post_id = keep.post_id
  AND g.id > keep.id;
"""

UNIQUE_INDEX = """
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS glow_one_per_account_post
ON interactions_glow (account_id, post_id);
"""

ATTACH = """
ALTER TABLE interactions_glow
ADD CONSTRAINT glow_one_per_account_post UNIQUE USING INDEX glow_one_per_account_post;
"""

DETACH = "ALTER TABLE interactions_glow DROP CONSTRAINT IF EXISTS glow_one_per_account_post;"


class Migration(migrations.Migration):
    atomic = False  # required for CREATE INDEX CONCURRENTLY

    dependencies = [
        ("interactions", "0004_comment_edited_at"),
        ("accounts", "0007_account_invited_by"),
        ("posts", "0010_post_time_indexes"),
    ]

    operations = [
        migrations.RunSQL(DEDUPE, migrations.RunSQL.noop),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(UNIQUE_INDEX, DETACH),
                migrations.RunSQL(ATTACH, migrations.RunSQL.noop),
            ],
            state_operations=[
                migrations.AddConstraint(
                    model_name="glow",
                    constraint=models.UniqueConstraint(
                        fields=["account", "post"], name="glow_one_per_account_post"
                    ),
                ),
            ],
        ),
        AddIndexConcurrently(
            model_name="glow",
            index=models.Index(fields=["account", "timestamp"], name="glow_author_time_idx"),
        ),
        AddIndexConcurrently(
            model_name="comment",
            index=models.Index(fields=["account", "dateTime"], name="comment_author_time_idx"),
        ),
    ]

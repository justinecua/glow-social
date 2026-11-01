# Database-level DEFAULT 0 for the counters. Django's `default=0` only applies
# to inserts made through the ORM; create_post() inserts with raw SQL that
# doesn't list these columns, so without this they'd be NULL and the insert
# would fail the NOT NULL constraint.
from django.db import migrations

SQL = """
ALTER TABLE posts_post ALTER COLUMN glow_count SET DEFAULT 0;
ALTER TABLE posts_post ALTER COLUMN comment_count SET DEFAULT 0;
"""
REVERSE = """
ALTER TABLE posts_post ALTER COLUMN glow_count DROP DEFAULT;
ALTER TABLE posts_post ALTER COLUMN comment_count DROP DEFAULT;
"""


class Migration(migrations.Migration):
    dependencies = [("posts", "0011_post_counters")]
    operations = [migrations.RunSQL(SQL, REVERSE)]

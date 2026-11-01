# Stored glow/comment counts on posts, maintained by Postgres triggers.
#
# Why triggers: glows and comments are written from raw SQL, the ORM, and
# cascades (deleting a post/account/comment thread). A trigger sees every
# one of those; app-level counters would drift on the paths they miss.
from django.db import migrations, models

BACKFILL = """
UPDATE posts_post p SET
    glow_count = COALESCE((SELECT COUNT(*) FROM interactions_glow g WHERE g.post_id = p.id), 0),
    comment_count = COALESCE((SELECT COUNT(*) FROM interactions_comment c WHERE c.post_id = p.id), 0);
"""

TRIGGERS = """
CREATE OR REPLACE FUNCTION glow_bump_post_counter() RETURNS trigger AS $$
DECLARE
    col text := TG_ARGV[0];  -- 'glow_count' or 'comment_count'
BEGIN
    IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.post_id IS NOT NULL THEN
        EXECUTE format('UPDATE posts_post SET %I = GREATEST(%I - 1, 0) WHERE id = $1', col, col)
        USING OLD.post_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.post_id IS NOT NULL THEN
        EXECUTE format('UPDATE posts_post SET %I = %I + 1 WHERE id = $1', col, col)
        USING NEW.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS glow_count_trg ON interactions_glow;
CREATE TRIGGER glow_count_trg
AFTER INSERT OR DELETE OR UPDATE OF post_id ON interactions_glow
FOR EACH ROW EXECUTE FUNCTION glow_bump_post_counter('glow_count');

DROP TRIGGER IF EXISTS comment_count_trg ON interactions_comment;
CREATE TRIGGER comment_count_trg
AFTER INSERT OR DELETE OR UPDATE OF post_id ON interactions_comment
FOR EACH ROW EXECUTE FUNCTION glow_bump_post_counter('comment_count');
"""

DROP_TRIGGERS = """
DROP TRIGGER IF EXISTS glow_count_trg ON interactions_glow;
DROP TRIGGER IF EXISTS comment_count_trg ON interactions_comment;
DROP FUNCTION IF EXISTS glow_bump_post_counter();
"""


class Migration(migrations.Migration):
    dependencies = [
        ("posts", "0010_post_time_indexes"),
        ("interactions", "0005_glow_unique_and_indexes"),
    ]

    operations = [
        migrations.AddField("post", "glow_count", models.PositiveIntegerField(default=0)),
        migrations.AddField("post", "comment_count", models.PositiveIntegerField(default=0)),
        # Triggers first, then backfill, all in one transaction: no write
        # can slip between the backfill and the trigger going live.
        migrations.RunSQL(TRIGGERS, DROP_TRIGGERS),
        migrations.RunSQL(BACKFILL, migrations.RunSQL.noop),
    ]

import os
from urllib.parse import urlparse

from django.conf import settings
from django.core.files import File
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError

from GlowProject.db import execute, fetch_tuples

COLUMNS = [  # (table, id column, link column)
    ("posts_photo", "id", "link"),
    ("sparks_spark", "id", "photo"),
    ("accounts_account", "id", "profile_photo"),
    ("accounts_account", "id", "cover_photo"),
]


class Command(BaseCommand):
    help = "Copy local uploads to S3_BUCKET storage and rewrite links. Safe to re-run; local files are kept. Try --dry-run first."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, dry_run=False, **options):
        if "FileSystemStorage" in settings.STORAGES["default"]["BACKEND"]:
            raise CommandError("Storage is still local disk. Set S3_BUCKET (and friends) first.")
        prefix = settings.MEDIA_URL.rstrip("/") + "/"
        moved = skipped = missing = 0
        for table, pk, col in COLUMNS:
            rows = fetch_tuples(  # table/column names come from COLUMNS, never user input
                f"SELECT {pk}, {col} FROM {table} WHERE {col} LIKE %s", [f"%{prefix}%"]
            )
            for row_id, link in rows:
                path = urlparse(link).path
                if not path.startswith(prefix):
                    skipped += 1
                    continue
                name = path[len(prefix):]
                local = os.path.join(settings.MEDIA_ROOT, name)
                if ".." in name.split("/") or not os.path.isfile(local):
                    missing += 1
                    self.stderr.write(f"missing: {table}.{col} id={row_id} {local}")
                    continue
                if dry_run:
                    moved += 1
                    continue
                with open(local, "rb") as fh:
                    stored = default_storage.save(name, File(fh))
                new_link = default_storage.url(stored)
                execute(f"UPDATE {table} SET {col} = %s WHERE {pk} = %s", [new_link, row_id])
                moved += 1
        verb = "would move" if dry_run else "moved"
        self.stdout.write(self.style.SUCCESS(f"{verb} {moved}, skipped {skipped}, missing {missing}"))

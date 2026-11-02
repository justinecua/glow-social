from django.core.management.base import BaseCommand

from sparks.services import purge_expired


class Command(BaseCommand):
    help = "Delete sparks older than 24 hours and their photo files. Run hourly: 0 * * * * manage.py purge_sparks"

    def handle(self, **opts):
        self.stdout.write(self.style.SUCCESS(f"Deleted {purge_expired()} expired spark(s)."))

from django.core.management.base import BaseCommand

from posts.bots import BOTS, run_bot


class Command(BaseCommand):
    help = (
        "Post one item from each content bot (or --only some). Bots: history, trivia, quotes, jokes, photos, "
        "learn, dogs, cats, space (set NASA_API_KEY), ph_weather, ph_holiday, ph_fact. "
        "Suggested cron, about 15 posts a day: 6am ph_weather ph_holiday; 8am quotes photos; 10am history space; "
        "noon trivia dogs; 3pm learn ph_fact; 6pm jokes cats; 9pm trivia"
    )

    def add_arguments(self, parser):
        parser.add_argument("--only", nargs="+", choices=sorted(BOTS), help="Run only these bots")
        parser.add_argument("--dry-run", action="store_true", help="Print posts without saving")

    def handle(self, only, dry_run, **opts):
        for key in only or BOTS:
            try:
                item = run_bot(key, dry_run=dry_run)
            except Exception as e:  # one failing source (network, bad JSON...) shouldn't stop the rest
                self.stderr.write(f"[{key}] failed: {e}")
                continue
            if not item:
                self.stdout.write(f"[{key}] nothing new to post")
                continue
            label = "would post" if dry_run else "posted"
            self.stdout.write(self.style.SUCCESS(f"[{key}] {label}:"))
            self.stdout.write(item.caption)
            if item.photo:
                self.stdout.write(f"  photo: {item.photo}")
            if item.comment:
                self.stdout.write(f"  comment: {item.comment}")
            self.stdout.write("-" * 40)

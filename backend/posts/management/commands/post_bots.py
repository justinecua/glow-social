"""Post one item from each of Glow's content bots.

    python manage.py post_bots                    # every bot, one post each
    python manage.py post_bots --only trivia jokes
    python manage.py post_bots --dry-run          # print, don't post

Bots: history, trivia (quiz poll), quotes, jokes, photos (Wikimedia
Picture of the Day), learn (Wikipedia featured article), dogs, cats,
space (NASA APOD; set NASA_API_KEY), and @glow_pilipinas: ph_weather,
ph_holiday (only posts on/near a holiday), ph_fact.
Trending topics have their own command: post_trending.

Suggested cron (about 15 posts a day, spread out):
    0 6  * * *   manage.py post_bots --only ph_weather ph_holiday
    0 8  * * *   manage.py post_bots --only quotes photos
    0 10 * * *   manage.py post_bots --only history space
    0 12 * * *   manage.py post_bots --only trivia dogs
    0 15 * * *   manage.py post_bots --only learn ph_fact
    0 18 * * *   manage.py post_bots --only jokes cats
    0 21 * * *   manage.py post_bots --only trivia
    0 */3 * * *  manage.py post_trending
    0 19 * * *   manage.py send_friend_digest
"""

from django.core.management.base import BaseCommand

from posts.bots import BOTS, run_bot


class Command(BaseCommand):
    help = "Post one item from each content bot (see module docstring for the list)."

    def add_arguments(self, parser):
        parser.add_argument("--only", nargs="+", choices=sorted(BOTS), help="Run only these bots")
        parser.add_argument("--dry-run", action="store_true", help="Print posts without saving")

    def handle(self, only, dry_run, **opts):
        for key in only or BOTS:
            try:
                item = run_bot(key, dry_run=dry_run)
            except Exception as e:  # one failing source shouldn't stop the rest
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

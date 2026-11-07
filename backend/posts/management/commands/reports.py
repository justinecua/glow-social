from collections import Counter

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from posts.queries import time_ago
from posts.reports import dismiss_reports, post_for_review, reported_posts


class Command(BaseCommand):
    help = "List reported posts (most reported first). --dismiss <code> clears the reports on a post that's fine."

    def add_arguments(self, parser):
        parser.add_argument("--dismiss", metavar="CODE", help="Post code from the link, e.g. lO5RV2QiRvW")

    def handle(self, dismiss, **opts):
        if dismiss:
            post = post_for_review(dismiss)
            if not post:
                raise CommandError(f"No post with code {dismiss!r}.")
            dismiss_reports(post["id"])
            self.stdout.write(self.style.SUCCESS(f"Cleared {post['report_count']} report(s) on {dismiss}."))
            return

        rows = reported_posts()
        if not rows:
            self.stdout.write("No reported posts.")
            return
        site = settings.FRONTEND_URL.rstrip("/")
        for row in rows:
            reasons = ", ".join(f"{reason} x{n}" for reason, n in Counter(row["reasons"]).items())
            caption = (row["caption"] or "").replace("\n", " ")[:60]
            self.stdout.write(
                f"{site}/post/{row['code']}  @{row['username']}  "
                f"{row['report_count']} report(s): {reasons}  last {time_ago(row['last_report']).lstrip('• ')}"
                f'\n    "{caption}"'
            )
        self.stdout.write("\nRemove one:  python manage.py remove_post <code>")
        self.stdout.write("It's fine:   python manage.py reports --dismiss <code>")

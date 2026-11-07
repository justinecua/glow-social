from django.core.management.base import BaseCommand, CommandError

from posts.posting import remove
from posts.reports import post_for_review


class Command(BaseCommand):
    help = "Delete a post (photos, comments, glows, reports) by the code in its link. Use --dry-run to look first."

    def add_arguments(self, parser):
        parser.add_argument("code", help="Post code from the link, e.g. lO5RV2QiRvW")
        parser.add_argument("--dry-run", action="store_true", help="Show the post without deleting it")

    def handle(self, code, dry_run, **opts):
        post = post_for_review(code)
        if not post:
            raise CommandError(f"No post with code {code!r}.")
        caption = (post["caption"] or "").replace("\n", " ")[:80]
        self.stdout.write(
            f"@{post['username']}  {post['photo_count']} photo(s)  {post['report_count']} report(s)\n"
            f'    "{caption}"'
        )
        if dry_run:
            self.stdout.write("Dry run: nothing deleted.")
            return
        remove(post["id"])  # same as the author deleting it: files, games, Explore cache
        self.stdout.write(self.style.SUCCESS(f"Deleted post {code}."))

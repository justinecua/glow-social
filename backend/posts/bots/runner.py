from dataclasses import dataclass
from datetime import timedelta
from typing import Callable

from django.db import transaction
from django.utils import timezone

from GlowProject.db import execute, fetch_value

from ..discover import bump_explore
from ..polls import create_poll
from ..queries import add_photo, add_tags, bot_account_id, insert_post
from ..visibility import audience_id
from . import animals, philippines, world


@dataclass
class Bot:
    username: str
    first_name: str
    last_name: str
    bio: str
    fetch: Callable  # returns a BotPost, or None if there's nothing good today
    dedupe_days: int  # don't repost the same photo or caption within this many days


PILIPINAS_BIO = "Automated account. Weather, holidays and fun facts from around the Philippines."

BOTS = {
    "history": Bot("glow_history", "Glow", "History", "Automated account. What happened on this day, from Wikipedia.", world.history, 365),
    "trivia": Bot("glow_trivia", "Glow", "Trivia", "Automated account. A quiz a day: vote, then see the answer. Questions from Open Trivia DB.", world.trivia, 90),
    "quotes": Bot("glow_quotes", "Glow", "Quotes", "Automated account. A little inspiration. Quotes from zenquotes.io.", world.quote, 180),
    "jokes": Bot("glow_jokes", "Glow", "Jokes", "Automated account. Clean jokes and puns, from JokeAPI.", world.joke, 180),
    "photos": Bot("glow_photos", "Glow", "Photos", "Automated account. Wikimedia Commons' Picture of the Day, with credit.", world.photo_of_the_day, 365),
    "learn": Bot("glow_learn", "Glow", "Learn", "Automated account. One interesting Wikipedia article a day.", world.featured_article, 365),
    "space": Bot("glow_space", "Glow", "Space", "Automated account. NASA's Astronomy Picture of the Day.", world.space, 365),
    "dogs": Bot("glow_dogs", "Glow", "Dogs", "Automated account. A dog a day. Photos from the Dog CEO API.", animals.dog, 365),
    "cats": Bot("glow_cats", "Glow", "Cats", "Automated account. A cat a day. Photos from TheCatAPI.", animals.cat, 365),
    "ph_weather": Bot("glow_pilipinas", "Glow", "Pilipinas", PILIPINAS_BIO, philippines.weather, 1),
    "ph_holiday": Bot("glow_pilipinas", "Glow", "Pilipinas", PILIPINAS_BIO, philippines.holiday, 7),
    "ph_fact": Bot("glow_pilipinas", "Glow", "Pilipinas", PILIPINAS_BIO, philippines.fact, 60),
}


def already_posted(account_id, post, since):  # same photo (or, with no photo, same caption) since `since`
    return fetch_value(
        """
        SELECT 1 FROM glow.glow.posts_post p
        WHERE p.account_id = %(account)s AND p."dateTime" >= %(since)s
          AND (
              (%(photo)s <> '' AND EXISTS (
                  SELECT 1 FROM glow.glow.posts_photo ph WHERE ph.post_id = p.id AND ph.link = %(photo)s))
              OR (%(photo)s = '' AND p.caption = %(caption)s)
          )
        LIMIT 1
        """,
        {"account": account_id, "since": since, "photo": post.photo, "caption": post.caption},
    ) is not None


def publish(account_id, post):  # saves a public post with its photo, tags, first comment and poll
    with transaction.atomic():
        post_id = insert_post(account_id, audience_id("public"), post.caption)
        if post.photo.startswith("https://"):
            add_photo(post_id, post.photo)
        add_tags(post_id, post.tags)
        if post.comment:
            execute(
                """
                INSERT INTO glow.glow.interactions_comment (content, "dateTime", post_id, account_id)
                VALUES (%s, %s, %s, %s)
                """,
                (post.comment, timezone.now(), post_id, account_id),
            )
        if post.poll_options:
            create_poll(post_id, post.poll_options, post.poll_hours, post.poll_correct)
    bump_explore()
    return post_id


def run_bot(key, dry_run=False, attempts=3):  # fetch and publish one new post; returns it, or None
    bot = BOTS[key]
    account_id = None if dry_run else bot_account_id(bot.username, bot.first_name, bot.last_name, bot.bio)
    since = timezone.now() - timedelta(days=bot.dedupe_days)

    for _ in range(attempts):  # random sources may hand back something we posted recently
        post = bot.fetch()
        if not post:
            continue
        if account_id and already_posted(account_id, post, since):
            continue
        if not dry_run:
            publish(account_id, post)
        return post
    return None

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from GlowProject.db import execute, fetch_all, fetch_one, fetch_value

MIN_OPTIONS, MAX_OPTIONS = 2, 4
OPTION_MAX_LEN = 80
DURATIONS_H = (24, 72, 168)  # 1 day, 3 days, 1 week
DEFAULT_DURATION_H = 24


class PollError(ValueError):
    pass


def clean_options(raw):
    if not isinstance(raw, list):
        raise PollError("Poll options must be a list.")
    options = [str(o).strip()[:OPTION_MAX_LEN] for o in raw if str(o).strip()]
    if len(options) < MIN_OPTIONS:
        raise PollError("A poll needs at least 2 options.")
    if len(options) > MAX_OPTIONS:
        raise PollError("A poll can have at most 4 options.")
    if len({o.lower() for o in options}) != len(options):
        raise PollError("Poll options must be different.")
    return options


def create_poll(post_id, options, hours=DEFAULT_DURATION_H, correct_index=None):  # `options` already cleaned
    hours = hours if hours in DURATIONS_H else DEFAULT_DURATION_H
    with transaction.atomic():
        poll_id = fetch_value(
            "INSERT INTO glow.glow.posts_poll (post_id, ends_at) VALUES (%s, %s) RETURNING id",
            (post_id, timezone.now() + timedelta(hours=hours)),
        )
        option_ids = [
            fetch_value(
                "INSERT INTO glow.glow.posts_polloption (poll_id, text, position) VALUES (%s, %s, %s) RETURNING id",
                (poll_id, text, position),
            )
            for position, text in enumerate(options)
        ]
        if correct_index is not None and 0 <= correct_index < len(option_ids):  # a quiz
            execute(
                "UPDATE glow.glow.posts_poll SET correct_option_id = %s WHERE id = %s",
                (option_ids[correct_index], poll_id),
            )
    return poll_id


def poll_data(post_ids, viewer_id=None):  # {post_id: poll} for the posts that have polls
    if not post_ids:
        return {}
    polls = fetch_all(
        """
        SELECT p.id, p.post_id, p.ends_at, p.correct_option_id,
               p.ends_at <= now() AS closed,
               (SELECT v.option_id FROM glow.glow.posts_pollvote v
                WHERE v.poll_id = p.id AND v.account_id = %(viewer)s) AS my_vote,
               ARRAY(
                   SELECT json_build_object(
                       'id', o.id,
                       'text', o.text,
                       'votes', (SELECT COUNT(*) FROM glow.glow.posts_pollvote v WHERE v.option_id = o.id)
                   )
                   FROM glow.glow.posts_polloption o
                   WHERE o.poll_id = p.id
                   ORDER BY o.position, o.id
               ) AS options
        FROM glow.glow.posts_poll p
        WHERE p.post_id = ANY(%(posts)s)
        """,
        {"posts": list(post_ids), "viewer": viewer_id},
    )
    return {
        poll["post_id"]: {
            "id": poll["id"],
            "options": poll["options"],
            "total": sum(o["votes"] for o in poll["options"]),
            "my_vote": poll["my_vote"],
            "ends_at": poll["ends_at"].isoformat(),
            "closed": poll["closed"],
            "correct_option": poll["correct_option_id"] if (poll["my_vote"] or poll["closed"]) else None,  # revealed after voting
            "is_quiz": poll["correct_option_id"] is not None,
        }
        for poll in polls
    }


def attach_polls(posts, viewer_id=None):  # adds a "poll" key (or None) to each post
    polls = poll_data([p["id"] for p in posts], viewer_id)
    for post in posts:
        post["poll"] = polls.get(post["id"])
    return posts


def vote(post_id, option_id, viewer_id):
    poll = fetch_one(
        "SELECT id, ends_at <= now() AS closed FROM glow.glow.posts_poll WHERE post_id = %s",
        (post_id,),
    )
    if not poll:
        raise PollError("This post doesn't have a poll.")
    if poll["closed"]:
        raise PollError("This poll has ended.")
    if not fetch_value(
        "SELECT 1 FROM glow.glow.posts_polloption WHERE id = %s AND poll_id = %s", (option_id, poll["id"])
    ):
        raise PollError("That option isn't part of this poll.")

    try:
        with transaction.atomic():  # a failed insert must not spoil the request's connection
            execute(
                """
                INSERT INTO glow.glow.posts_pollvote (poll_id, option_id, account_id, created_at)
                VALUES (%s, %s, %s, %s)
                """,
                (poll["id"], option_id, viewer_id, timezone.now()),
            )
    except IntegrityError:
        raise PollError("You've already voted on this poll.")  # one vote per person (unique constraint)
    return poll_data([post_id], viewer_id)[post_id]

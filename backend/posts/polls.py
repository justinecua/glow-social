"""Polls on posts: create, vote, and attach results to post dicts."""

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count
from django.utils import timezone

from .models import Poll, PollOption, PollVote

MIN_OPTIONS, MAX_OPTIONS = 2, 4
OPTION_MAX_LEN = 80
DURATIONS_H = (24, 72, 168)  # 1 day, 3 days, 1 week
DEFAULT_DURATION_H = 24


class PollError(ValueError):
    pass


def clean_options(raw):
    if not isinstance(raw, list):
        raise PollError("Poll options must be a list.")
    opts = [str(o).strip()[:OPTION_MAX_LEN] for o in raw if str(o).strip()]
    if len(opts) < MIN_OPTIONS:
        raise PollError("A poll needs at least 2 options.")
    if len(opts) > MAX_OPTIONS:
        raise PollError("A poll can have at most 4 options.")
    if len({o.lower() for o in opts}) != len(opts):
        raise PollError("Poll options must be different.")
    return opts


def create_poll(post_id, options, hours=DEFAULT_DURATION_H, correct_index=None):
    """Attach a poll to a post. `options` should already be cleaned."""
    hours = hours if hours in DURATIONS_H else DEFAULT_DURATION_H
    with transaction.atomic():
        poll = Poll.objects.create(post_id=post_id, ends_at=timezone.now() + timedelta(hours=hours))
        objs = PollOption.objects.bulk_create(
            [PollOption(poll=poll, text=t, position=i) for i, t in enumerate(options)]
        )
        if correct_index is not None and 0 <= correct_index < len(objs):
            poll.correct_option = objs[correct_index]
            poll.save(update_fields=["correct_option"])
    return poll


def poll_data(post_ids, viewer_id=None):
    """{post_id: poll dict} for the posts that have polls."""
    polls = list(Poll.objects.filter(post_id__in=post_ids).prefetch_related("options"))
    if not polls:
        return {}
    counts = {
        r["option_id"]: r["n"]
        for r in PollVote.objects.filter(poll__in=polls).values("option_id").annotate(n=Count("id"))
    }
    mine = {}
    if viewer_id:
        mine = dict(
            PollVote.objects.filter(poll__in=polls, account_id=viewer_id).values_list("poll_id", "option_id")
        )
    now = timezone.now()
    out = {}
    for poll in polls:
        my_vote = mine.get(poll.id)
        closed = poll.ends_at <= now
        options = [
            {"id": o.id, "text": o.text, "votes": counts.get(o.id, 0)} for o in poll.options.all()
        ]
        out[poll.post_id] = {
            "id": poll.id,
            "options": options,
            "total": sum(o["votes"] for o in options),
            "my_vote": my_vote,
            "ends_at": poll.ends_at.isoformat(),
            "closed": closed,
            # Only reveal the right answer after you've voted (or it's over).
            "correct_option": poll.correct_option_id if (my_vote or closed) else None,
            "is_quiz": poll.correct_option_id is not None,
        }
    return out


def attach_polls(posts, viewer_id=None):
    """Add a "poll" key (or None) to each post dict, in place."""
    data = poll_data([p["id"] for p in posts], viewer_id) if posts else {}
    for p in posts:
        p["poll"] = data.get(p["id"])
    return posts


def vote(post_id, option_id, viewer_id):
    poll = Poll.objects.filter(post_id=post_id).first()
    if not poll:
        raise PollError("This post doesn't have a poll.")
    if poll.ends_at <= timezone.now():
        raise PollError("This poll has ended.")
    if not PollOption.objects.filter(id=option_id, poll=poll).exists():
        raise PollError("That option isn't part of this poll.")
    try:
        PollVote.objects.create(poll=poll, option_id=option_id, account_id=viewer_id)
    except IntegrityError:
        raise PollError("You've already voted on this poll.")
    return poll_data([post_id], viewer_id)[post_id]

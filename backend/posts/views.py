from datetime import datetime

import pytz
from django.conf import settings
from django.http import HttpResponseNotFound
from django.shortcuts import render
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auth_utils import current_account_id

from . import posting
from .discover import explore, feed, mark_seen, new_posts_since, post_by_code, posts_by_tag, posts_by_user, search
from .polls import PollError, vote
from .prompts import today_prompt
from .queries import find_own_post, glow_post, unglow_post
from .reports import ReportError, report_post
from .services.link_preview import get_link_preview
from .visibility import can_view_post, viewer_account_id


def bad_request(message):
    return Response({"detail": str(message)}, status=status.HTTP_400_BAD_REQUEST)


def not_found():
    return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)


def as_id(value):  # ids in a request body arrive as text or numbers; anything else is invalid
    return int(value) if str(value).isdigit() else None


def number_param(request, name, default, smallest, largest):  # ?limit=... clamped to a safe range
    value = request.query_params.get(name)
    if not str(value).isdigit():
        return default
    return min(largest, max(smallest, int(value)))


def feed_opened_at(request):  # ?seed= is the ms timestamp the feed opened: it shuffles the feed and freezes "now"
    seed = request.query_params.get("seed", "")
    try:
        return seed, datetime.fromtimestamp(int(seed) / 1000, tz=pytz.utc)
    except (ValueError, OverflowError, OSError):
        return None, None


class GetPosts(APIView):  # the home feed
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        offset = number_param(request, "offset", 0, 0, 100_000)
        limit = number_param(request, "limit", 5, 1, 30)
        seed, opened_at = feed_opened_at(request)
        return Response(feed(request, viewer_account_id(request), offset, limit, seed=seed, anchor=opened_at))


class NewPostsSince(APIView):  # how many posts appeared since the feed opened (the "New posts" pill)
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        _, opened_at = feed_opened_at(request)
        if opened_at is None:
            return bad_request("Invalid seed.")
        return Response(new_posts_since(viewer_account_id(request), opened_at))


class MarkSeen(APIView):  # POST {"ids": [...]}: posts that were on screen, so the feed shows new ones next time
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        ids = request.data.get("ids") or []
        if not isinstance(ids, list):
            return bad_request("ids must be a list.")
        return Response({"marked": mark_seen(current_account_id(request), ids[:100])})


class GetPostsByUser(APIView):  # a profile's posts, only the ones this viewer may see
    permission_classes = (permissions.AllowAny,)

    def get(self, request, account_id):
        limit = number_param(request, "limit", 12, 1, 50)
        before = request.query_params.get("before")
        return Response(posts_by_user(account_id, request, viewer_account_id(request), limit=limit, before=before))


class GetPost(APIView):  # one post, for the shareable /post/<code> page
    permission_classes = (permissions.AllowAny,)

    def get(self, request, code):
        post = post_by_code(code, request, viewer_account_id(request))
        if not post:
            return not_found()
        return Response(post)


class CreatePost(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            post = posting.publish(current_account_id(request), request)
        except posting.PostError as e:
            return bad_request(e)
        return Response(post)


class PostDetail(APIView):  # PATCH edits your post's caption or audience; DELETE removes it
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, post_id):
        post = find_own_post(post_id, current_account_id(request))
        if not post:
            return not_found()
        try:
            return Response(posting.edit(post, request.data))
        except posting.PostError as e:
            return bad_request(e)

    def delete(self, request, post_id):
        if not find_own_post(post_id, current_account_id(request)):
            return not_found()
        posting.remove(post_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportPost(APIView):  # flag a post for the owner to review
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, post_id):
        try:
            report_post(current_account_id(request), post_id, request.data.get("reason"))
        except ReportError as e:
            return bad_request(e)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SendGlow(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        me = current_account_id(request)
        post_id = as_id(request.data.get("postId"))
        if not post_id or not can_view_post(post_id, me):
            return not_found()
        return Response(glow_post(me, post_id))


class SendUnglow(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        post_id = as_id(request.data.get("postId"))
        if not post_id:
            return not_found()
        return Response(unglow_post(current_account_id(request), post_id))


class VotePoll(APIView):  # POST {"option_id": n}; one vote per person
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, post_id):
        me = current_account_id(request)
        if not can_view_post(post_id, me):
            return not_found()
        option_id = as_id(request.data.get("option_id"))
        if not option_id:
            return bad_request("Pick an option.")
        try:
            return Response(vote(post_id, option_id, me))
        except PollError as e:
            return bad_request(e)


class TodayPrompt(APIView):  # today's question or photo challenge
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        return Response(today_prompt())


class Explore(APIView):  # trending posts, photos, tags and people; or one tag's posts with ?tag=
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        tag = request.query_params.get("tag")
        if tag:
            return Response({"tag": tag, "results": posts_by_tag(tag, request)})
        return Response(explore(request))


class Search(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        return Response(search(request.query_params.get("q", ""), request))


class LinkPreview(APIView):  # title, image and site name for a link in a caption
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        url = (request.query_params.get("url") or "").strip()
        if not url or len(url) > 2048:
            return bad_request("url is required")
        preview = get_link_preview(url)
        if not preview:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(preview)


def share_post_page(request, code):  # the page link previews (Messenger, Facebook) read; people get redirected to the app
    post = post_by_code(code, request)  # public posts only: crawlers aren't signed in
    if not post:
        return HttpResponseNotFound("Post not found")

    caption = (post["caption"] or "").strip()
    return render(request, "posts/share.html", {
        "title": f"@{post['username'] or 'someone'} on Glow",
        "description": caption[:197] + "…" if len(caption) > 200 else caption or "See this post on Glow",
        "image": post["photos"][0] if post["photos"] else "",
        "share_url": request.build_absolute_uri(),
        "app_url": f"{settings.FRONTEND_URL.rstrip('/')}/post/{post['code']}",
    })

from accounts.auth_utils import current_account_id
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from drf_yasg.utils import swagger_auto_schema
from rest_framework_simplejwt.tokens import RefreshToken
from posts.services.external_feeds import (
    getJokes,
    getUselessFacts,
    getAdvice,
    getQuotes,
    getRiddle,
    getMemeFromReddit,
    getRandomAnimeImage
)

from .discover import explore, feed, posts_by_tag, posts_by_user, search, single_post
from .visibility import audience_id, can_view_post, viewer_account_id
from accounts.auth_utils import account_id_for_user
from .queries import (
    getPosts,
    getPostsByUser,
    create_post,
    sendGlow,
    sendUnglow
)

from .api.decorators import (
    get_posts_decorator,
)


class GetPosts(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        try:
            offset = max(0, int(request.query_params.get('offset', 0)))
            limit = min(30, max(1, int(request.query_params.get('limit', 5))))
        except ValueError:
            return Response({"detail": "Invalid paging."}, status=status.HTTP_400_BAD_REQUEST)
        # Friends-first for signed-in users; plain newest-first otherwise.
        try:
            viewer = account_id_for_user(request.user)
        except Exception:
            viewer = None
        return Response(feed(request, viewer, offset, limit))

class GetPostsByUser(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, account_id):
        # Only the posts this viewer is allowed to see (friends / close
        # friends / only me are filtered out for everyone else).
        posts = posts_by_user(account_id, request, viewer_account_id(request))
        return Response({"results": posts})

class CreatePost(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        accID = current_account_id(request)  # ignore client-sent accID
        # "public" | "friends" | "close_friends" | "only_me" (default public)
        audience_key = str(request.data.get("audience") or "public")
        if audience_key not in ("public", "friends", "close_friends", "only_me"):
            audience_key = "public"
        audience = audience_id(audience_key)
        caption = request.data.get("caption")
        photos = request.data.get("photos", [])
        taglist = request.data.get("taglist", [])

        data = create_post(accID, audience, caption, photos, taglist, request=request)
        if isinstance(data, dict) and data.get("id"):
            data["audience"] = audience_key
        return Response(data)

class PostDetail(APIView):
    """PATCH: edit your own post's caption and/or audience.
    DELETE: delete your own post (comments, glows, shares and photos go with it)."""
    permission_classes = (permissions.IsAuthenticated,)

    def _own_post(self, request, post_id):
        from .models import Post
        return Post.objects.filter(id=post_id, account_id=current_account_id(request)).first()

    def patch(self, request, post_id):
        post = self._own_post(request, post_id)
        if not post:
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        fields = []
        if "caption" in request.data:
            caption = str(request.data.get("caption") or "").strip()
            if len(caption) > 800:
                return Response({"detail": "Posts can be up to 800 characters."}, status=status.HTTP_400_BAD_REQUEST)
            if not caption and not post.photo_set.exists():
                return Response({"detail": "A post needs text or a photo."}, status=status.HTTP_400_BAD_REQUEST)
            post.caption = caption
            fields.append("caption")

        audience_key = request.data.get("audience")
        if audience_key is not None:
            if audience_key not in ("public", "friends", "close_friends", "only_me"):
                return Response({"detail": "Unknown audience."}, status=status.HTTP_400_BAD_REQUEST)
            post.audience_id = audience_id(audience_key)
            fields.append("audience")

        if fields:
            post.save(update_fields=fields)
        return Response({"id": post.id, "caption": post.caption, "audience": audience_key or None})

    def delete(self, request, post_id):
        post = self._own_post(request, post_id)
        if not post:
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        # Remove uploaded photo files from disk (best effort).
        import os
        from django.conf import settings
        for link in post.photo_set.values_list("link", flat=True):
            if link and link.startswith(settings.MEDIA_URL):
                path = os.path.join(settings.MEDIA_ROOT, link[len(settings.MEDIA_URL):].lstrip("/"))
                try:
                    os.remove(path)
                except OSError:
                    pass
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SendGlow(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        accID = current_account_id(request)  # ignore client-sent accID
        postId = request.data.get("postId")
        if not can_view_post(postId, accID):
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        data = sendGlow(accID, postId)
        return Response(data)

class SendUnglow(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        accID = current_account_id(request)  # ignore client-sent accID
        postId = request.data.get("postId")

        data = sendUnglow(accID, postId)
        return Response(data)

# External Api
class GetJokes(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        data = getJokes()
        return Response(data)


class GetUselessFacts(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        data = getUselessFacts()
        return Response(data)


class GetAdvice(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        data = getAdvice()
        return Response(data)


class GetQuotes(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        data = getQuotes()
        return Response(data)


class GetRiddles(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        data = getRiddle()
        return Response(data)


class GetMemeFromReddit(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        data = getMemeFromReddit()
        return Response(data)


class GetRandomAnimeImage(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        data = getRandomAnimeImage()
        return Response(data)


class Explore(APIView):
    """Trending posts, recent photos, popular tags and active people.
    Built from Glow's own content; cached briefly."""
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


class GetPost(APIView):
    """A single post (for the shareable /post/<id> page)."""
    permission_classes = (permissions.AllowAny,)

    def get(self, request, post_id):
        post = single_post(post_id, request, viewer_account_id(request))
        if not post:
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(post)



def share_post_page(request, post_id):
    """Link-preview page for a post.

    Messenger/Facebook/Discord crawlers don't run JavaScript, so they can't
    read the React app. This returns plain HTML with Open Graph tags for the
    preview card, then sends real visitors on to the app's /post/<id> page.
    """
    from django.conf import settings
    from django.http import HttpResponse, HttpResponseNotFound
    from django.utils.html import escape

    post = single_post(post_id, request)
    frontend = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    target = f"{frontend}/post/{post_id}"
    if not post:
        return HttpResponseNotFound("Post not found")

    who = post.get("username") or "someone"
    caption = (post.get("caption") or "").strip()
    title = f"@{who} on Glow"
    description = (caption[:197] + "…") if len(caption) > 200 else (caption or "See this post on Glow")
    image = (post.get("photos") or [""])[0]

    tags = [
        ("og:type", "article"),
        ("og:site_name", "Glow"),
        ("og:title", title),
        ("og:description", description),
        ("og:url", request.build_absolute_uri()),
    ]
    if image:
        tags.append(("og:image", image))
    meta = "\n".join(
        f'<meta property="{k}" content="{escape(v)}">' for k, v in tags
    )
    html = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description)}">
{meta}
<meta name="twitter:card" content="{'summary_large_image' if image else 'summary'}">
<meta http-equiv="refresh" content="0; url={escape(target)}">
<link rel="canonical" href="{escape(target)}">
</head><body>
<p><a href="{escape(target)}">Open this post on Glow</a></p>
</body></html>"""
    return HttpResponse(html)

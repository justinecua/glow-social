import json
import re

from GlowProject.media import MediaError, delete_media, read_image

from .discover import bump_explore
from .polls import PollError, clean_options, create_poll, poll_data
from .queries import AUDIENCES, MAX_CAPTION, create_post, delete_post, update_post
from .realtime import notify_new_post
from .visibility import audience_id

MAX_PHOTOS = 10
MAX_TAGS = 10


class PostError(ValueError):  # a problem with what the user sent; shown to them as-is
    pass


def json_field(data, name, default):  # multipart forms send JSON fields as text
    value = data.get(name, default)
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return default
    return value


def read_caption(data):
    caption = str(data.get("caption") or "").strip()
    if len(caption) > MAX_CAPTION:
        raise PostError(f"Posts can be up to {MAX_CAPTION} characters.")
    return caption


def read_audience(data):
    audience = str(data.get("audience") or "public")
    if audience not in AUDIENCES:
        raise PostError("Unknown audience.")
    return audience


def read_photos(request):  # image bytes, checked to be real JPG/PNG/GIF/WebP
    sources = request.FILES.getlist("photos")
    if not sources:  # older app versions send [{"origurl": "data:image/..."}]
        sources = [p.get("origurl") for p in request.data.get("photos") or [] if isinstance(p, dict)]
    if len(sources) > MAX_PHOTOS:
        raise PostError(f"Up to {MAX_PHOTOS} photos per post.")
    try:
        return [read_image(source) for source in sources]
    except MediaError as e:
        raise PostError(str(e))


def read_tags(data, caption):  # tags the app sent, plus any #hashtags in the caption
    sent = json_field(data, "taglist", [])
    sent = [str(tag)[:50] for tag in sent] if isinstance(sent, list) else []
    hashtags = re.findall(r"#(\w{2,50})", caption)
    return list(dict.fromkeys(sent + hashtags))[:MAX_TAGS]  # no duplicates, original order


def read_poll(data):  # (options, hours), or (None, None) when there's no poll
    poll = json_field(data, "poll", None)
    if not poll:
        return None, None
    try:
        options = clean_options(poll.get("options"))
    except PollError as e:
        raise PostError(str(e))
    hours = poll.get("hours")
    return options, int(hours) if str(hours).isdigit() else 24


def publish(account_id, request):  # validates everything first, then saves; returns the post as the feed shows it
    caption = read_caption(request.data)
    audience = read_audience(request.data) if request.data.get("audience") else "public"
    photos = read_photos(request)
    if not caption and not photos:
        raise PostError("A post needs text or a photo.")
    tags = read_tags(request.data, caption)
    poll_options, poll_hours = read_poll(request.data)

    post = create_post(account_id, audience_id(audience), caption, photos, tags, request=request)
    post["audience"] = audience
    post["poll"] = None
    if poll_options:
        create_poll(post["id"], poll_options, poll_hours)
        post["poll"] = poll_data([post["id"]], account_id)[post["id"]]

    bump_explore()
    notify_new_post(account_id, audience)
    return post


def edit(post, data):  # `post` from find_own_post; changes only the fields that were sent
    caption = read_caption(data) if "caption" in data else None
    if caption == "" and not post["has_photos"]:
        raise PostError("A post needs text or a photo.")
    audience = read_audience(data) if data.get("audience") is not None else None

    update_post(post["id"], caption, audience_id(audience) if audience else None)
    bump_explore()  # Explore must never show a post that's no longer public
    return {
        "id": post["id"],
        "caption": post["caption"] if caption is None else caption,
        "audience": audience,
    }


def remove(post_id):
    for link in delete_post(post_id):
        delete_media(link)
    bump_explore()

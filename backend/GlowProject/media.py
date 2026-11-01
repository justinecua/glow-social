"""One place for user uploads (post photos, spark photos, profile photos).

- Validates by content, not by name: the first bytes must be JPG/PNG/GIF/WebP,
  and the size is capped. Client-sent filenames are never used (they allowed
  writing outside MEDIA_ROOT, e.g. "../../x").
- Stores through Django's storage API (settings.STORAGES["default"]), so the
  same code writes to local disk in dev and to S3 / Cloudflare R2 / MinIO in
  production. Switching is configuration only; see settings.py.
- Accepts real multipart uploads (UploadedFile) and, for one release, the
  old base64 data URLs.
"""

import base64
import binascii
import uuid
from urllib.parse import urlparse

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

MAX_IMAGE_BYTES = 8 * 1024 * 1024


class MediaError(ValueError):
    """Shown to the user as-is."""


def image_ext(data):
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def read_image(source):
    """Bytes of an uploaded image: an UploadedFile (multipart) or a base64
    data URL (legacy). Raises MediaError with a user-facing message."""
    if hasattr(source, "read"):  # UploadedFile: check size before reading
        if getattr(source, "size", 0) > MAX_IMAGE_BYTES:
            raise MediaError("Photos must be 8 MB or smaller.")
        data = source.read(MAX_IMAGE_BYTES + 1)
    elif isinstance(source, str) and source.startswith("data:") and "," in source:
        payload = source.split(",", 1)[1]
        if len(payload) > MAX_IMAGE_BYTES * 4 // 3 + 4:
            raise MediaError("Photos must be 8 MB or smaller.")
        try:
            data = base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError):
            raise MediaError("That photo couldn't be read.")
    else:
        raise MediaError("That photo couldn't be read.")
    if len(data) > MAX_IMAGE_BYTES:
        raise MediaError("Photos must be 8 MB or smaller.")
    if not image_ext(data):
        raise MediaError("Use a JPG, PNG, GIF or WebP image.")
    return data


def save_image(data, folder):
    """Store validated image bytes under `folder/` with a random name.
    Returns the public URL (relative /media/... locally, absolute on a CDN)."""
    name = default_storage.save(f"{folder}/{uuid.uuid4().hex}.{image_ext(data)}", ContentFile(data))
    return default_storage.url(name)


def delete_media(url):
    """Best-effort delete of a file we stored, given its public URL. URLs we
    don't own (external images, other hosts) are ignored."""
    if not url:
        return
    path = urlparse(url).path
    prefixes = [urlparse(default_storage.url("")).path, settings.MEDIA_URL]
    for prefix in prefixes:
        prefix = prefix.rstrip("/") + "/"
        if prefix != "/" and path.startswith(prefix):
            name = path[len(prefix):]
            if name and ".." not in name.split("/"):
                try:
                    default_storage.delete(name)
                except Exception:
                    pass
            return

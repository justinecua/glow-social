"""Editing your own profile: names, bio, gender, birthday, profile and cover
photos. Photos arrive as data URLs (same as post photos) and are saved under
MEDIA_ROOT/profiles/."""

from datetime import date


from GlowProject.media import MediaError, delete_media, read_image, save_image

MAX_PHOTO_BYTES = 8 * 1024 * 1024
GENDERS = {"", "male", "female", "non-binary", "other", "prefer not to say"}

# First bytes of each allowed image type -> file extension.
_SIGNATURES = (
    (b"\xff\xd8\xff", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
)


class ProfileError(ValueError):
    pass


def _image_ext(data: bytes):
    for sig, ext in _SIGNATURES:
        if data.startswith(sig):
            return ext
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _save_photo(source, folder: str, request) -> str:
    """Validate + store a profile/cover photo (multipart file or data URL)."""
    try:
        link = save_image(read_image(source), f"profiles/{folder}")
    except MediaError as e:
        raise ProfileError(str(e))
    return request.build_absolute_uri(link) if request and link.startswith("/") else link


def _delete_old(url):
    """Remove a previously uploaded profile file (best effort)."""
    delete_media(url)


def _text(data, key, max_len):
    v = data.get(key)
    if v is None:
        return None
    v = str(v).strip()
    if len(v) > max_len:
        raise ProfileError(f"{key.capitalize()} must be {max_len} characters or fewer.")
    return v


def update_profile(account, data, request=None):
    """Apply the fields present in `data` to `account`. Missing keys are left
    unchanged; `profile_photo`/`cover_photo` set to null or "" remove them."""
    changed = []

    for key, max_len in (("firstname", 50), ("lastname", 50), ("bio", 255)):
        v = _text(data, key, max_len)
        if v is not None:
            setattr(account, key, v)
            changed.append(key)

    if "gender" in data:
        g = (data.get("gender") or "").strip().lower()
        if g not in GENDERS:
            raise ProfileError("Pick a gender from the list.")
        account.gender = g
        changed.append("gender")

    if "birthday" in data:
        b = data.get("birthday")
        if not b:
            account.birthday = None
        else:
            try:
                bd = date.fromisoformat(str(b))
            except ValueError:
                raise ProfileError("Birthday must be a valid date.")
            today = date.today()
            if bd > today or bd.year < 1900:
                raise ProfileError("Birthday must be a valid date.")
            account.birthday = bd
            account.age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
            changed.append("age")
        changed.append("birthday")

    new_files = []
    try:
        for key, folder in (("profile_photo", "avatars"), ("cover_photo", "covers")):
            if key not in data:
                continue
            v = data.get(key)
            old = getattr(account, key)
            if not v:
                setattr(account, key, None if key == "profile_photo" else "")
            elif isinstance(v, str) and v.startswith("data:"):
                url = _save_photo(v, folder, request)
                new_files.append(url)
                setattr(account, key, url)
            else:
                continue  # unchanged URL sent back: ignore
            changed.append(key)
            new_files.append(("old", old))
    except ProfileError:
        for f in new_files:
            if isinstance(f, str):
                _delete_old(f)
        raise

    if changed:
        account.save(update_fields=list(dict.fromkeys(changed)))
        for f in new_files:
            if isinstance(f, tuple):
                _delete_old(f[1])

    return {
        "account_id": account.id,
        "firstname": account.firstname,
        "lastname": account.lastname,
        "bio": account.bio,
        "gender": account.gender,
        "birthday": account.birthday.isoformat() if account.birthday else None,
        "profile_photo": account.profile_photo,
        "cover_photo": account.cover_photo,
    }

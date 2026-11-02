from datetime import date

from GlowProject.db import execute, fetch_one
from GlowProject.media import MediaError, delete_media, read_image, save_image

from .registration import age_on

GENDERS = {"", "male", "female", "non-binary", "other", "prefer not to say"}
TEXT_FIELDS = (("firstname", 50), ("lastname", 50), ("bio", 255))  # (field, max length)
PHOTO_FIELDS = (("profile_photo", "avatars"), ("cover_photo", "covers"))  # (field, media folder)


class ProfileError(ValueError):
    pass


def get_account(user_id):
    return fetch_one(
        """
        SELECT id, firstname, lastname, bio, gender, birthday, profile_photo, cover_photo
        FROM glow.glow.accounts_account
        WHERE auth_user_id = %s
        """,
        (user_id,),
    )


def text_changes(data):
    changes = {}
    for field, max_len in TEXT_FIELDS:
        if data.get(field) is None:
            continue  # not sent: leave it as it is
        value = str(data[field]).strip()
        if len(value) > max_len:
            raise ProfileError(f"{field.capitalize()} must be {max_len} characters or fewer.")
        changes[field] = value
    return changes


def gender_change(data):
    if "gender" not in data:
        return {}
    gender = (data["gender"] or "").strip().lower()
    if gender not in GENDERS:
        raise ProfileError("Pick a gender from the list.")
    return {"gender": gender}


def birthday_changes(data):
    if "birthday" not in data:
        return {}
    if not data["birthday"]:
        return {"birthday": None}  # cleared

    try:
        birthday = date.fromisoformat(str(data["birthday"]))
    except ValueError:
        raise ProfileError("Birthday must be a valid date.")
    today = date.today()
    if birthday > today or birthday.year < 1900:
        raise ProfileError("Birthday must be a valid date.")
    return {"birthday": birthday, "age": age_on(birthday, today)}


def photo_changes(data):
    changes, saved = {}, []
    try:
        for field, folder in PHOTO_FIELDS:
            if field not in data:
                continue
            value = data[field]
            if not value:
                changes[field] = None if field == "profile_photo" else ""  # removed
            elif isinstance(value, str) and value.startswith("data:"):  # a new upload; anything else is the current URL sent back
                changes[field] = save_image(read_image(value), f"profiles/{folder}")
                saved.append(changes[field])
    except MediaError as e:
        for link in saved:
            delete_media(link)  # undo this request's uploads
        raise ProfileError(str(e))
    return changes


def save_changes(account_id, changes):
    columns = ", ".join(f"{field} = %s" for field in changes)  # field names come from this file, never from the user
    execute(
        f"UPDATE glow.glow.accounts_account SET {columns} WHERE id = %s",
        [*changes.values(), account_id],
    )


def update_profile(account, data):  # `account` from get_account; only fields present in `data` change
    changes = {**text_changes(data), **gender_change(data), **birthday_changes(data)}
    photos = photo_changes(data)
    changes.update(photos)

    if changes:
        save_changes(account["id"], changes)
        for field in photos:
            delete_media(account[field])  # the old photo is no longer used
        account.update(changes)

    return {
        "account_id": account["id"],
        "firstname": account["firstname"],
        "lastname": account["lastname"],
        "bio": account["bio"],
        "gender": account["gender"],
        "birthday": account["birthday"].isoformat() if account["birthday"] else None,
        "profile_photo": account["profile_photo"],
        "cover_photo": account["cover_photo"],
    }

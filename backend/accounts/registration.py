import re
from datetime import date

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from .legal import MIN_AGE, TERMS_VERSION
from .queries import find_invite

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,30}$")


def age_on(birthday, today):  # whole years; one day short of a birthday doesn't count
    return today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))


def validate_registration(data):  # returns (cleaned, errors); never trust the browser for these
    errors = {}

    username = str(data.get("username") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    birthday_raw = str(data.get("birthday") or "").strip()
    accepted_terms = data.get("accepted_terms") is True
    terms_version = str(data.get("terms_version") or "")
    marketing_opt_in = data.get("marketing_opt_in") is True

    if not USERNAME_RE.match(username):
        errors["username"] = "Username must be 3–30 characters: letters, numbers, _ or ."

    try:
        validate_email(email)
    except ValidationError:
        errors["email"] = "Enter a valid email address."

    birthday = None
    try:
        birthday = date.fromisoformat(birthday_raw)
    except ValueError:
        errors["birthday"] = "Enter your date of birth."
    else:
        today = date.today()
        if birthday > today or birthday.year < 1900:
            errors["birthday"] = "Enter a valid date of birth."
        elif age_on(birthday, today) < MIN_AGE:
            errors["birthday"] = f"You must be at least {MIN_AGE} years old to use Glow."

    try:
        validate_password(password, user=User(username=username, email=email))  # AUTH_PASSWORD_VALIDATORS
    except ValidationError as e:
        errors["password"] = " ".join(e.messages)

    if not accepted_terms:
        errors["accepted_terms"] = "You must agree to the Terms of Service and Privacy Policy."
    elif terms_version != TERMS_VERSION:
        errors["accepted_terms"] = "Our Terms have been updated. Please reload the page and review them."

    inviter_name = str(data.get("invited_by") or "").strip()
    inviter = find_invite(inviter_name) if inviter_name else None  # unknown inviter is ignored, not an error
    invited_by_id = inviter["id"] if inviter else None

    cleaned = {
        "invited_by_id": invited_by_id,
        "username": username,
        "email": email,
        "password": password,
        "birthday": birthday,
        "terms_version": TERMS_VERSION,
        "marketing_opt_in": marketing_opt_in,
    }
    return cleaned, errors

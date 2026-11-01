"""Server-side validation for sign-up. Never trust the browser for these
checks: age, consent and password rules must be enforced here."""

import re
from datetime import date

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from .legal import MIN_AGE, TERMS_VERSION

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,30}$")


def _age_on(birthday: date, today: date) -> int:
    return today.year - birthday.year - (
        (today.month, today.day) < (birthday.month, birthday.day)
    )


def validate_registration(data):
    """Returns (cleaned, errors). `errors` maps field -> message."""
    errors = {}

    username = str(data.get("username") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    birthday_raw = str(data.get("birthday") or "").strip()
    accepted_terms = data.get("accepted_terms") is True
    terms_version = str(data.get("terms_version") or "")
    marketing_opt_in = data.get("marketing_opt_in") is True

    if not USERNAME_RE.match(username):
        errors["username"] = (
            "Username must be 3–30 characters: letters, numbers, _ or ."
        )

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
        elif _age_on(birthday, today) < MIN_AGE:
            # Don't store anything for under-age sign-ups.
            errors["birthday"] = f"You must be at least {MIN_AGE} years old to use Glow."

    try:
        # Uses AUTH_PASSWORD_VALIDATORS: min 8 chars, not common, not all
        # numbers, not too similar to username/email.
        validate_password(password, user=User(username=username, email=email))
    except ValidationError as e:
        errors["password"] = " ".join(e.messages)

    if not accepted_terms:
        errors["accepted_terms"] = (
            "You must agree to the Terms of Service and Privacy Policy."
        )
    elif terms_version != TERMS_VERSION:
        errors["accepted_terms"] = (
            "Our Terms have been updated. Please reload the page and review them."
        )

    # Optional inviter (from /invite/<username>). Unknown names are ignored
    # rather than blocking sign-up.
    invited_by_id = None
    inviter = str(data.get("invited_by") or "").strip()
    if inviter:
        from .models import Account

        invited_by_id = (
            Account.objects.filter(
                auth_user__username__iexact=inviter, auth_user__is_active=True
            )
            .values_list("id", flat=True)
            .first()
        )

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

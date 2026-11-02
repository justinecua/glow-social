import hashlib
import logging
import os
import secrets
from datetime import timedelta

import requests
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from GlowProject.db import execute, fetch_all, fetch_one, fetch_value

log = logging.getLogger(__name__)

MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
RESET_LINK_LIFETIME = timedelta(hours=1)

USERNAME_TAKEN = {"message": "Username is already taken.", "status": 400}
EMAIL_TAKEN = {"message": "Email is already in use.", "status": 400}
RESET_EMAIL_SENT = {"message": "If that email has an account, we sent a reset link.", "status": 200}


def signed_in_user(user_id):  # the one "who am I" shape, used by login and /me
    return fetch_one(
        """
        SELECT
            u.id AS user_id,
            u.id,
            a.id AS account_id,
            u.username,
            u.email,
            u.date_joined,
            COALESCE(a.firstname, '') AS firstname,
            COALESCE(a.lastname, '') AS lastname,
            COALESCE(a.gender, '') AS gender,
            COALESCE(a.bio, '') AS bio,
            COALESCE(date_part('year', age(a.birthday))::int, a.age) AS age,
            a.birthday,
            a.profile_photo,
            COALESCE(a.cover_photo, '') AS cover_photo
        FROM glow.glow.auth_user u
        LEFT JOIN glow.glow.accounts_account a ON a.auth_user_id = u.id
        WHERE u.id = %s
        """,
        (user_id,),
    )


def login(username, password):  # the signed-in user, or None if username or password is wrong
    credentials = fetch_one(
        """
        SELECT u.id, u.password
        FROM glow.glow.auth_user u
        JOIN glow.glow.accounts_account a ON a.auth_user_id = u.id
        WHERE LOWER(u.username) = LOWER(%s) AND u.is_active
        """,
        (username,),
    )
    if not credentials or not check_password(password, credentials["password"]):
        return None
    return signed_in_user(credentials["id"])  # the password hash never leaves this function


def username_taken(username):
    return fetch_value(
        "SELECT 1 FROM glow.glow.auth_user WHERE LOWER(username) = LOWER(%s)", (username,)
    ) is not None


def email_taken(email):
    return fetch_value(
        "SELECT 1 FROM glow.glow.auth_user WHERE LOWER(email) = LOWER(%s)", (email,)
    ) is not None


def create_auth_user(username, email, password, now):
    return fetch_value(
        """
        INSERT INTO glow.glow.auth_user
            (username, email, password, date_joined, is_superuser,
             first_name, last_name, is_staff, is_active)
        VALUES (%s, %s, %s, %s, false, '', '', false, true)
        RETURNING id
        """,
        (username, email, make_password(password), now),
    )


def create_account(user_id, birthday, terms_version, marketing_opt_in, invited_by_id, now):
    return fetch_value(
        """
        INSERT INTO glow.glow.accounts_account
            (auth_user_id, birthday, terms_version, terms_accepted_at,
             marketing_opt_in, marketing_opt_in_at, invited_by_id,
             firstname, lastname, gender, bio, ui_appearance,
             cover_photo, is_online, is_bot)
        VALUES (%s, %s, %s, %s, %s, %s, %s, '', '', '', '', '', '', false, false)
        RETURNING id
        """,
        (
            user_id,
            birthday,
            terms_version,
            now,
            marketing_opt_in,
            now if marketing_opt_in else None,
            invited_by_id,
        ),
    )


def befriend_inviter(inviter_id, new_account_id, new_username, now):  # invited sign-ups start out as friends
    execute(
        """
        INSERT INTO glow.glow.friends_friend
            (status, date_friend_request, date_became_friends, user_id, friend_id)
        VALUES ('Friends', %s, %s, %s, %s)
        """,
        (now, now, inviter_id, new_account_id),
    )
    execute(
        """
        INSERT INTO glow.glow.notifications_notification
            (status, notif_type_id, notif_to_id, notif_from_id, content, created_at)
        SELECT 'Unread', id, %s, %s, %s, %s
        FROM glow.glow.notifications_notificationtype
        WHERE type = 'invite_joined'
        """,  # inserts nothing if the notification type doesn't exist
        (inviter_id, new_account_id, f"@{new_username} joined Glow from your invite 🎉 You're now friends.", now),
    )


def register(username, email, password, birthday, terms_version, marketing_opt_in=False, invited_by_id=None):  # inputs validated in registration.py
    if username_taken(username):
        return USERNAME_TAKEN
    if email_taken(email):
        return EMAIL_TAKEN

    now = timezone.now()
    try:
        with transaction.atomic():
            user_id = create_auth_user(username, email, password, now)
            account_id = create_account(user_id, birthday, terms_version, bool(marketing_opt_in), invited_by_id, now)
            if invited_by_id:
                befriend_inviter(invited_by_id, account_id, username, now)
    except IntegrityError:
        return USERNAME_TAKEN  # someone took the name between our check and the insert

    return {"message": "Signup successful!", "status": 201}


def send_email(recipient, subject, text):
    return requests.post(
        f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
        auth=("api", MAILGUN_API_KEY),
        data={
            "from": f"Glow <support@{MAILGUN_DOMAIN}>",
            "to": [recipient],
            "subject": subject,
            "text": text,
        },
        timeout=10,
    )


def hash_token(token):  # only the hash is stored, so a database leak can't reset passwords
    return hashlib.sha256(token.encode()).hexdigest()


def forgot_password(email):
    user = fetch_one(
        "SELECT id, username FROM glow.glow.auth_user WHERE LOWER(email) = LOWER(%s) AND is_active",
        (email,),
    )
    if not user:
        return RESET_EMAIL_SENT  # same answer either way, so nobody can test which emails have accounts

    token = secrets.token_urlsafe(32)
    execute(
        """
        INSERT INTO glow.glow.accounts_passwordreset (user_id, token, expires_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id)
        DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
        """,
        (user["id"], hash_token(token), timezone.now() + RESET_LINK_LIFETIME),
    )

    reset_link = f"{settings.FRONTEND_URL}/resetpassword?token={token}"
    text = (
        f"Hi {user['username']},\n\n"
        "You asked to reset your Glow password. Open this link to choose a new one:\n"
        f"{reset_link}\n\n"
        "The link expires in 1 hour. If you didn't ask for this, you can ignore this email."
    )
    response = send_email(email, "Reset your Glow password", text)
    if response.status_code != 200:
        log.error("Mailgun API error: %s", response.text)
        return {"message": "We couldn't send the email. Please try again later.", "status": 502}

    return RESET_EMAIL_SENT


def reset_password(token, new_password):
    reset = fetch_one(
        """
        SELECT r.user_id, r.expires_at, u.username, u.email
        FROM glow.glow.accounts_passwordreset r
        JOIN glow.glow.auth_user u ON u.id = r.user_id
        WHERE r.token = %s
        """,
        (hash_token(token or ""),),
    )
    if not reset or timezone.now() > reset["expires_at"]:
        return {"message": "This reset link is invalid or has expired.", "status": 400}

    try:
        validate_password(new_password, user=User(username=reset["username"], email=reset["email"]))  # unsaved User, only for the "too similar" check
    except ValidationError as e:
        return {"message": " ".join(e.messages), "status": 400}

    with transaction.atomic():
        execute(
            "UPDATE glow.glow.auth_user SET password = %s WHERE id = %s",
            (make_password(new_password), reset["user_id"]),
        )
        execute("DELETE FROM glow.glow.accounts_passwordreset WHERE user_id = %s", (reset["user_id"],))  # each link works once

    return {"message": "Password has been reset successfully.", "status": 200}


def get_new_users():
    return fetch_all(
        """
        SELECT a.id, u.username, u.date_joined, COALESCE(a.profile_photo, '') AS profile_photo
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE u.is_active AND NOT a.is_bot
        ORDER BY u.date_joined DESC
        LIMIT 30
        """
    )


def get_profile(profile_id, viewer_user_id=None):  # a list with 0 or 1 profile (the frontend expects a list)
    profile = fetch_one(
        """
        SELECT
            a.id, a.firstname, a.lastname, a.gender, a.bio,
            a.profile_photo, a.cover_photo, a.is_online, a.last_activity, a.is_bot,
            u.id AS auth_user_id, u.username, u.date_joined,
            u.email, a.birthday
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.id = %s
        """,
        (profile_id,),
        blank_nulls=True,
    )
    if not profile:
        return []

    is_owner = profile.pop("auth_user_id") == viewer_user_id
    if not is_owner:  # email and birthday are private
        del profile["email"]
        del profile["birthday"]
    return [profile]


def count_glows_received(account_id):
    return fetch_value(
        """
        SELECT COUNT(*)
        FROM glow.glow.interactions_glow g
        JOIN glow.glow.posts_post p ON p.id = g.post_id
        WHERE p.account_id = %s
        """,
        (account_id,),
        default=0,
    )


def find_invite(username):  # public card shown on /invite/<username>
    return fetch_one(
        """
        SELECT a.id, u.username,
               COALESCE(a.firstname, '') AS firstname,
               COALESCE(a.lastname, '') AS lastname,
               COALESCE(a.profile_photo, '') AS profile_photo
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE LOWER(u.username) = LOWER(%s) AND u.is_active
        """,
        (username,),
    )


def list_invitees(account_id, limit=50):
    invitees = fetch_all(
        """
        SELECT a.id, u.username,
               COALESCE(a.firstname, '') AS firstname,
               COALESCE(a.lastname, '') AS lastname,
               COALESCE(a.profile_photo, '') AS profile_photo,
               u.date_joined AS joined
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.invited_by_id = %s AND u.is_active
        ORDER BY u.date_joined DESC
        LIMIT %s
        """,
        (account_id, limit),
    )
    for person in invitees:
        person["joined"] = person["joined"].isoformat()

    total = fetch_value(
        """
        SELECT COUNT(*)
        FROM glow.glow.accounts_account a
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        WHERE a.invited_by_id = %s AND u.is_active
        """,
        (account_id,),
    )
    return {"count": total, "invitees": invitees}


def onboarding_progress(account_id):
    counts = fetch_one(
        """
        SELECT
            COALESCE(a.profile_photo, '') <> '' AS has_photo,
            (SELECT COUNT(*) FROM glow.glow.friends_friend f
             WHERE (f.user_id = a.id OR f.friend_id = a.id)
               AND f.status IN ('Friends', 'Pending')) AS friends_count,
            (SELECT COUNT(*) FROM glow.glow.posts_post p
             WHERE p.account_id = a.id) AS posts_count
        FROM glow.glow.accounts_account a
        WHERE a.id = %s
        """,
        (account_id,),
    )
    steps = {
        "photo": counts["has_photo"],
        "friends": counts["friends_count"] >= 3,
        "post": counts["posts_count"] > 0,
    }
    return {
        "steps": steps,
        "friends_count": counts["friends_count"],
        "posts_count": counts["posts_count"],
        "done": all(steps.values()),
    }

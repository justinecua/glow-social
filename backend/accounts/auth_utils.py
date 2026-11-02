import logging

from django.core import signing
from django.core.cache import cache
from rest_framework.exceptions import PermissionDenied

from GlowProject.db import fetch_value

log = logging.getLogger(__name__)

WS_TICKET_SALT = "glow.ws-ticket"
WS_TICKET_MAX_AGE = 60  # seconds: only needs to survive until the socket opens


def account_id_for_user(user):  # cached: never changes and nearly every request needs it
    if not user or not user.is_authenticated:
        return None
    key = f"account_id_for_user:{user.pk}"
    try:
        cached = cache.get(key)
    except Exception:  # Redis down: ask the database
        log.warning("Cache read failed for %s", key, exc_info=True)
        cached = None
    if cached:
        return cached
    account_id = fetch_value("SELECT id FROM glow.glow.accounts_account WHERE auth_user_id = %s LIMIT 1", (user.pk,))
    if account_id:
        try:
            cache.set(key, account_id, 60 * 60)
        except Exception:  # Redis down: still works, just uncached
            log.warning("Cache write failed for %s", key, exc_info=True)
    return account_id


def current_account_id(request):  # never trust account ids sent by the client
    account_id = account_id_for_user(request.user)
    if account_id is None:
        raise PermissionDenied("No account for this user.")
    return account_id


def require_self(request, account_id):  # 403 unless the URL's account is the caller's
    if str(current_account_id(request)) != str(account_id):
        raise PermissionDenied("You can only access your own data.")


def make_ws_ticket(account_id):
    return signing.dumps({"a": account_id}, salt=WS_TICKET_SALT)


def read_ws_ticket(ticket):
    try:
        data = signing.loads(ticket, salt=WS_TICKET_SALT, max_age=WS_TICKET_MAX_AGE)
        return int(data["a"])
    except (signing.BadSignature, KeyError, TypeError, ValueError):
        return None

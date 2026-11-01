from django.core.cache import cache
"""Identity helpers: who is making this request?

Never trust account IDs sent by the client (request body, URL or WebSocket
message). Derive the acting account from the authenticated session instead.
"""

from django.core import signing
from rest_framework.exceptions import PermissionDenied

from .models import Account

WS_TICKET_SALT = "glow.ws-ticket"
WS_TICKET_MAX_AGE = 60  # seconds: only needs to survive until the socket opens


def account_id_for_user(user):
    """The signed-in user's account id. Cached in Redis: it never changes, and
    almost every request needs it."""
    if not user or not user.is_authenticated:
        return None
    key = f"account_id_for_user:{user.pk}"
    try:
        cached = cache.get(key)
    except Exception:
        cached = None  # Redis down: ask the database
    if cached:
        return cached
    account_id = Account.objects.filter(auth_user=user).values_list("id", flat=True).first()
    if account_id:
        try:
            cache.set(key, account_id, 60 * 60)
        except Exception:
            pass
    return account_id


def current_account_id(request):
    """Account id of the signed-in user, or 403 if they have no account."""
    account_id = account_id_for_user(request.user)
    if account_id is None:
        raise PermissionDenied("No account for this user.")
    return account_id


def require_self(request, account_id):
    """403 unless `account_id` (e.g. from the URL) is the caller's own."""
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

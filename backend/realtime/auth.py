"""WebSocket authentication.

The socket identifies the user once, at connect time, from a short-lived
signed ticket: ?ticket=... obtained from /api/accounts/wsTicket/ (an
authenticated HTTP call). Any user_id the client sends later is ignored.

Ticket-only on purpose: unlike cookies, a ticket is never attached
automatically by the browser, so another website can't open an
authenticated socket on a user's behalf (cross-site WebSocket hijacking),
and it works even when the WebSocket host differs from the API host.
"""

from urllib.parse import parse_qs

from accounts.auth_utils import read_ws_ticket


class WebSocketAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        ticket = (query.get("ticket") or [None])[0]
        account_id = read_ws_ticket(ticket) if ticket else None
        return await self.app(dict(scope, account_id=account_id), receive, send)

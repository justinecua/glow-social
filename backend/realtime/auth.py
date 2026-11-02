from urllib.parse import parse_qs

from accounts.auth_utils import read_ws_ticket


class WebSocketAuthMiddleware:  # identifies the socket once, from a short-lived signed ?ticket=
    def __init__(self, app):  # tickets (not cookies) stop other sites opening a socket as the user
        self.app = app

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        ticket = (query.get("ticket") or [None])[0]
        account_id = read_ws_ticket(ticket) if ticket else None
        return await self.app(dict(scope, account_id=account_id), receive, send)

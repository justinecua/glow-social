from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


class JWTTokenCookieMiddleware:
    """Copy the access_token cookie into the Authorization header.

    Only a *valid* token is forwarded. An expired/garbage cookie is ignored,
    so the request is treated as anonymous: public endpoints (feed, profiles,
    comments) keep working, and protected ones still return 401 so the client
    refreshes its token.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        access_token = request.COOKIES.get("access_token")

        if access_token and "HTTP_AUTHORIZATION" not in request.META:
            try:
                AccessToken(access_token)
            except TokenError:
                pass
            else:
                request.META["HTTP_AUTHORIZATION"] = f"Bearer {access_token}"

        return self.get_response(request)

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


class JWTTokenCookieMiddleware:  # copies a valid access_token cookie into the Authorization header
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        access_token = request.COOKIES.get("access_token")
        if access_token and "HTTP_AUTHORIZATION" not in request.META:
            try:
                AccessToken(access_token)
            except TokenError:
                pass  # bad token: request stays anonymous, protected endpoints still 401
            else:
                request.META["HTTP_AUTHORIZATION"] = f"Bearer {access_token}"
        return self.get_response(request)

"""Rate limits.

Defaults (settings.REST_FRAMEWORK) apply to every API request:
  anon  - per IP, for signed-out browsing (feed, explore, share previews)
  user  - per account, all requests (reads included; generous)
  write - per account (or IP), only POST/PUT/PATCH/DELETE: posting,
          commenting, glowing, messaging, kudos, sparks...
Login/register/password-reset add AuthThrottle: strict, per IP, to slow
credential stuffing and sign-up spam.

Behind a reverse proxy set NUM_PROXIES (env) so the client IP is read from
X-Forwarded-For instead of the proxy's address.
"""

from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import SimpleRateThrottle


class WriteThrottle(SimpleRateThrottle):
    scope = "write"

    def get_cache_key(self, request, view):
        if request.method in SAFE_METHODS:
            return None  # reads aren't limited by this throttle
        user = getattr(request, "user", None)
        ident = user.pk if user is not None and user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class AuthThrottle(SimpleRateThrottle):
    scope = "auth"

    def get_cache_key(self, request, view):
        if request.method in SAFE_METHODS:
            return None
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}

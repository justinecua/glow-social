"""
ASGI config for GlowProject project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""
import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from channels.security.websocket import OriginValidator


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'GlowProject.settings')
django.setup()

import GlowProject.routing  # noqa: E402  (needs apps loaded)
from django.conf import settings  # noqa: E402
from realtime.auth import WebSocketAuthMiddleware  # noqa: E402


websocket_app = WebSocketAuthMiddleware(
    URLRouter(GlowProject.routing.websocket_urlpatterns)
)
# Optional extra protection: restrict which sites may open a socket.
# Set WS_ALLOWED_ORIGINS (comma-separated, e.g.
# "https://glow.example.com,http://localhost:5173") to enable.
if settings.WS_ALLOWED_ORIGINS:
    websocket_app = OriginValidator(websocket_app, settings.WS_ALLOWED_ORIGINS)

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    # Every socket must present a valid ticket (see realtime/auth.py).
    "websocket": websocket_app,
})
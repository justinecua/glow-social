"""Log slow HTTP requests (method, path, status, ms) so hot spots show up in
production logs without a profiler. Threshold: SLOW_REQUEST_MS (default 500).
Also adds a Server-Timing header, visible in the browser's Network tab."""

import logging
import os
import time

log = logging.getLogger("glow.slow")
SLOW_MS = int(os.getenv("SLOW_REQUEST_MS", "500"))


class RequestTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()
        response = self.get_response(request)
        ms = (time.perf_counter() - start) * 1000
        response["Server-Timing"] = f"app;dur={ms:.0f}"
        if ms >= SLOW_MS:
            log.warning("slow %s %s -> %s in %.0f ms", request.method, request.path, response.status_code, ms)
        return response

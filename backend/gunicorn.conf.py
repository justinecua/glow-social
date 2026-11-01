"""Gunicorn for the HTTP API (WSGI). Websockets are served by Daphne
separately (see docker-compose.prod.yml).

Why not Daphne for everything: under ASGI, Django runs ordinary (sync)
views on ONE shared thread per process, so a single Daphne process handles
one API request at a time. Gunicorn runs WEB_WORKERS processes x
WEB_THREADS threads, so that many requests run in parallel per container.

Sizing: workers ~ 2 x CPU cores; threads 4-8 (requests mostly wait on
Postgres/Redis). Keep workers x threads x containers below PgBouncer's
pool size headroom (see docker-compose.prod.yml).
"""

import multiprocessing
import os

bind = "0.0.0.0:8000"
workers = int(os.getenv("WEB_WORKERS", multiprocessing.cpu_count() * 2))
threads = int(os.getenv("WEB_THREADS", 4))
worker_class = "gthread"
timeout = int(os.getenv("WEB_TIMEOUT", 30))
graceful_timeout = 20
keepalive = 5
# Recycle workers now and then to contain slow memory growth.
max_requests = 2000
max_requests_jitter = 200
accesslog = "-"
errorlog = "-"

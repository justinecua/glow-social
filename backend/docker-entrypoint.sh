#!/bin/sh
set -e

if [ -n "$DB_HOST" ]; then
  echo "Waiting for Postgres at $DB_HOST:${DB_PORT:-5432}..."
  until pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -q; do sleep 1; done
fi

if [ "$RUN_MIGRATIONS" != "False" ]; then  # prod sets False: migrations on the live DB are run by hand
  python manage.py migrate --noinput
fi

exec "$@"

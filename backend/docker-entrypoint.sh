#!/bin/sh
set -e

# Apply migrations on start (set RUN_MIGRATIONS=0 to skip, e.g. when migrating from CI).
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  alembic upgrade head
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips='*'

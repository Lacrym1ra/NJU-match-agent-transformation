#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

mkdir -p ops/maintenance
touch ops/maintenance/enabled
touch ops/maintenance/manual-enabled
rm -f ops/maintenance/auto-enabled

if docker ps --format '{{.Names}}' | grep -qx 'nju-date-frontend'; then
  docker exec nju-date-frontend nginx -t >/dev/null
fi

echo "Maintenance mode is ON."
echo "Public traffic will be served by maintenance.html without touching the backend."

#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

rm -f \
  ops/maintenance/enabled \
  ops/maintenance/manual-enabled \
  ops/maintenance/auto-enabled \
  ops/maintenance/auto-alerted \
  ops/maintenance/recovery-alerted \
  ops/maintenance/failures

if docker ps --format '{{.Names}}' | grep -qx 'nju-date-frontend'; then
  docker exec nju-date-frontend nginx -t >/dev/null
fi

echo "Maintenance mode is OFF."
echo "Public traffic is back to the normal frontend and API proxy."

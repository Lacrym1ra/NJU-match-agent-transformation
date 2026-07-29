#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

STATE_DIR="ops/maintenance"
mkdir -p "$STATE_DIR"

FAILURES_FILE="$STATE_DIR/failures"

read_env_value() {
  key="$1"
  file=".env"
  if [ -f "$file" ]; then
    value="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
    if [ -n "$value" ]; then
      printf '%s' "$value" | sed "s/^['\"]//; s/['\"]$//"
      return 0
    fi
  fi
  return 1
}

if [ -z "${BACKEND_WATCHDOG_FAILURE_THRESHOLD:-}" ]; then
  BACKEND_WATCHDOG_FAILURE_THRESHOLD="$(read_env_value BACKEND_WATCHDOG_FAILURE_THRESHOLD || echo 3)"
fi

THRESHOLD="$BACKEND_WATCHDOG_FAILURE_THRESHOLD"

send_alert() {
  subject="$1"
  body="$2"

  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is not installed; skip alert email."
    return 0
  fi

  if [ ! -f ".env" ]; then
    echo "No root .env found; skip alert email."
    return 0
  fi

  if ! docker image inspect nju-date-backend >/dev/null 2>&1; then
    echo "nju-date-backend image is missing; skip alert email."
    return 0
  fi

  docker run --rm \
    --env-file .env \
    -e "MAINTENANCE_ALERT_SUBJECT=$subject" \
    -e "MAINTENANCE_ALERT_BODY=$body" \
    -v "$PWD/scripts/maintenance-alert-mail.mjs:/tmp/maintenance-alert-mail.mjs:ro" \
    nju-date-backend \
    node /tmp/maintenance-alert-mail.mjs || true
}

backend_ok() {
  docker inspect nju-date-backend >/dev/null 2>&1 || return 1
  [ "$(docker inspect -f '{{.State.Running}}' nju-date-backend 2>/dev/null)" = "true" ] || return 1

  docker exec nju-date-backend node -e "
    const url = 'http://127.0.0.1:3000/health';
    fetch(url, { signal: AbortSignal.timeout(4000) })
      .then((res) => process.exit(res.ok ? 0 : 1))
      .catch(() => process.exit(1));
  " >/dev/null 2>&1
}

if backend_ok; then
  echo 0 > "$FAILURES_FILE"

  if [ -f "$STATE_DIR/auto-enabled" ] && [ ! -f "$STATE_DIR/manual-enabled" ]; then
    rm -f "$STATE_DIR/enabled" "$STATE_DIR/auto-enabled" "$STATE_DIR/auto-alerted"
    if [ ! -f "$STATE_DIR/recovery-alerted" ]; then
      touch "$STATE_DIR/recovery-alerted"
      send_alert \
        "[NJU Match] 后端已恢复，自动维护模式已关闭" \
        "NJU Match backend recovered at $(date -Is).

The watchdog removed ops/maintenance/enabled because the backend health check is passing again."
    fi
  fi

  echo "Backend health check OK."
  exit 0
fi

failures=0
if [ -f "$FAILURES_FILE" ]; then
  failures="$(cat "$FAILURES_FILE" 2>/dev/null || echo 0)"
fi
case "$failures" in
  ''|*[!0-9]*) failures=0 ;;
esac
failures=$((failures + 1))
echo "$failures" > "$FAILURES_FILE"

echo "Backend health check failed ($failures/$THRESHOLD)."

if [ "$failures" -lt "$THRESHOLD" ]; then
  exit 0
fi

if [ ! -f "$STATE_DIR/manual-enabled" ]; then
  touch "$STATE_DIR/enabled" "$STATE_DIR/auto-enabled"
fi

rm -f "$STATE_DIR/recovery-alerted"

if [ ! -f "$STATE_DIR/auto-alerted" ]; then
  touch "$STATE_DIR/auto-alerted"
  send_alert \
    "[NJU Match] 后端宕机，已自动开启维护模式" \
    "NJU Match backend health check failed $failures consecutive time(s) at $(date -Is).

The watchdog created ops/maintenance/enabled, so frontend Nginx is now serving maintenance.html without proxying to the backend.

Please check:
- docker compose ps
- docker logs --tail=200 nju-date-backend
- docker logs --tail=100 nju-date-postgres"
fi

exit 0

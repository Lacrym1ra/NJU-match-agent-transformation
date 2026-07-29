#!/usr/bin/env sh
set -eu

case "${1:-status}" in
  on)
    sh "$(dirname "$0")/maintenance-on.sh"
    ;;
  off)
    sh "$(dirname "$0")/maintenance-off.sh"
    ;;
  status)
    sh "$(dirname "$0")/maintenance-status.sh"
    ;;
  *)
    echo "Usage: sh scripts/maintenance.sh [on|off|status]" >&2
    exit 2
    ;;
esac

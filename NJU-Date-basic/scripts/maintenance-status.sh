#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if [ -f ops/maintenance/enabled ]; then
  if [ -f ops/maintenance/manual-enabled ]; then
    echo "Maintenance mode: ON (manual)"
  elif [ -f ops/maintenance/auto-enabled ]; then
    echo "Maintenance mode: ON (auto)"
  else
    echo "Maintenance mode: ON"
  fi
else
  echo "Maintenance mode: OFF"
fi

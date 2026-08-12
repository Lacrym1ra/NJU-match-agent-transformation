#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="${REPO_ROOT}/NJU-Date-basic"
ENV_FILE="${APP_DIR}/.env.codespaces"

if [[ "${CODESPACES:-}" == "true" ]]; then
  FORWARDING_DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  PUBLIC_URL="https://${CODESPACE_NAME}-8082.${FORWARDING_DOMAIN}"
else
  PUBLIC_URL="http://127.0.0.1:8082"
fi

echo
echo "NJU Match demo: ${PUBLIC_URL}"

if [[ ! -s "${ENV_FILE}" ]]; then
  echo "The demo environment has not been created yet."
  echo "Run: bash .devcontainer/scripts/bootstrap-demo.sh"
  exit 0
fi

cd "${APP_DIR}"
docker compose --env-file "${ENV_FILE}" ps 2>/dev/null || true

if curl --fail --silent --max-time 3 http://127.0.0.1:8082/health >/dev/null; then
  echo "Health check: OK"
else
  echo "Health check: not ready"
fi

echo "Port 8082 must be Public in the Codespaces PORTS panel."

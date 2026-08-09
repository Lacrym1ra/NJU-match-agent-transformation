#!/usr/bin/env bash
set -euo pipefail

credential_file="/etc/credstore.encrypted/nju-match-llm-api-key.cred"
credential_name="llm_api_key"
service_name="nju-match.service"

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this command with sudo." >&2
    exit 1
  fi
}

store_secret() {
  local secret temporary
  read -r -s -p "Enter the LLM API key (input hidden): " secret
  echo
  if [[ ${#secret} -lt 16 ]]; then
    unset secret
    echo "The supplied value is unexpectedly short; credential not changed." >&2
    exit 1
  fi

  install -d -m 0700 /etc/credstore.encrypted
  temporary="$(mktemp /etc/credstore.encrypted/.nju-match-llm.XXXXXX)"
  trap 'rm -f "${temporary:-}"; unset secret' EXIT
  printf '%s' "${secret}" | systemd-creds encrypt --name="${credential_name}" - "${temporary}"
  unset secret
  chmod 0600 "${temporary}"
  mv -f "${temporary}" "${credential_file}"
  trap - EXIT
  echo "LLM credential stored in encrypted form; plaintext was not written to disk."
}

case "${1:-}" in
  set|update)
    require_root
    command -v systemd-creds >/dev/null || { echo "systemd-creds is required." >&2; exit 1; }
    store_secret
    if systemctl is-enabled --quiet "${service_name}" 2>/dev/null; then
      systemctl restart "${service_name}"
      echo "${service_name} restarted."
    else
      echo "Enable ${service_name} after installing its unit file."
    fi
    ;;
  status)
    if [[ -f "${credential_file}" ]]; then
      echo "configured (encrypted credential present)"
      exit 0
    fi
    echo "not configured"
    exit 1
    ;;
  clear)
    require_root
    read -r -p "Delete the encrypted LLM credential? [y/N] " answer
    if [[ "${answer}" != "y" && "${answer}" != "Y" ]]; then
      echo "Cancelled."
      exit 0
    fi
    rm -f -- "${credential_file}"
    systemctl stop "${service_name}" 2>/dev/null || true
    echo "Credential removed and ${service_name} stopped."
    ;;
  *)
    echo "Usage: sudo bash $0 {set|update|status|clear}" >&2
    exit 2
    ;;
esac

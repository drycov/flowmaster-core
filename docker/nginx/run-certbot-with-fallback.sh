#!/bin/bash
set -e

. /scripts/util.sh
. /etc/nginx/ensure-self-signed-cert.sh

domain="${CERTBOT_DOMAIN:-${PROXY_DOMAIN:-}}"
live="/etc/letsencrypt/live/${domain}"
renewal="/etc/letsencrypt/renewal/${domain}.conf"

if [ "${SSL_SELF_SIGNED_FALLBACK:-1}" = "1" ] && [ -f "${live}/.self-signed" ] && [ ! -f "${renewal}" ]; then
  info "Removing self-signed fallback before Let's Encrypt attempt"
  rm -rf "${live:?}/"*
fi

if /scripts/run_certbot.orig.sh "$@"; then
  if [ -f "${live}/.self-signed" ]; then
    rm -f "${live}/.self-signed"
  fi
  exit 0
fi

if [ "${SSL_SELF_SIGNED_FALLBACK:-1}" = "1" ] && [ ! -f "${renewal}" ]; then
  warning "Certbot failed; restoring self-signed certificate for '${domain}'"
  ensure_self_signed_cert
  auto_enable_configs
  if nginx -t; then
    nginx -s reload
  fi
fi

exit 1

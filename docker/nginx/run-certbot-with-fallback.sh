#!/bin/bash

. /scripts/util.sh
. "$(cd "$(dirname "$0")" && pwd)/ensure-self-signed-cert.sh"

domain="${CERTBOT_DOMAIN:-${PROXY_DOMAIN:-}}"
live="/etc/letsencrypt/live/${domain}"
renewal="/etc/letsencrypt/renewal/${domain}.conf"

has_letsencrypt_cert() {
  [ -f "${renewal}" ] && [ -s "${live}/privkey.pem" ] && [ -s "${live}/fullchain.pem" ]
}

restore_self_signed_if_needed() {
  if [ "${SSL_SELF_SIGNED_FALLBACK:-1}" != "1" ]; then
    return 1
  fi
  if has_letsencrypt_cert; then
    return 0
  fi

  warning "Let's Encrypt unavailable for '${domain}'; using self-signed fallback"
  ensure_self_signed_cert
  auto_enable_configs
  if nginx -t; then
    nginx -s reload
  else
    error "Nginx config invalid after self-signed fallback"
    return 1
  fi
  return 0
}

if [ "${SSL_SELF_SIGNED_FALLBACK:-1}" = "1" ] && [ -f "${live}/.self-signed" ] && ! has_letsencrypt_cert; then
  info "Removing self-signed fallback before Let's Encrypt attempt"
  rm -rf "${live:?}/"*
fi

/scripts/run_certbot.orig.sh "$@" || true

if has_letsencrypt_cert; then
  rm -f "${live}/.self-signed"
  exit 0
fi

restore_self_signed_if_needed
exit 0

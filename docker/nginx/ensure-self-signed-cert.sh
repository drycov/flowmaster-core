#!/bin/bash
# Bootstrap TLS when Let's Encrypt certs are not available yet.
# Installed paths match jonasal/nginx-certbot layout so nginx auto_enable_configs works.

ensure_self_signed_cert() {
  if [ "${SSL_SELF_SIGNED_FALLBACK:-1}" != "1" ]; then
    return 0
  fi

  local domain="${CERTBOT_DOMAIN:-${PROXY_DOMAIN:-localhost}}"
  local live="/etc/letsencrypt/live/${domain}"
  local renewal="/etc/letsencrypt/renewal/${domain}.conf"

  if [ -f "${renewal}" ]; then
    return 0
  fi

  if [ -s "${live}/fullchain.pem" ] && [ -s "${live}/privkey.pem" ] && [ ! -f "${live}/.self-signed" ]; then
    return 0
  fi

  if [ -s "${live}/fullchain.pem" ] && [ -f "${live}/.self-signed" ]; then
    return 0
  fi

  mkdir -p "${live}"

  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "${live}/privkey.pem" \
    -out "${live}/fullchain.pem" \
    -days "${SSL_SELF_SIGNED_DAYS:-365}" \
    -subj "/CN=${domain}/O=Flowmaster Self-Signed/C=KZ" \
    -addext "subjectAltName=DNS:${domain}" 2>/dev/null \
    || openssl req -x509 -nodes -newkey rsa:2048 \
      -keyout "${live}/privkey.pem" \
      -out "${live}/fullchain.pem" \
      -days "${SSL_SELF_SIGNED_DAYS:-365}" \
      -subj "/CN=${domain}/O=Flowmaster Self-Signed/C=KZ"

  cp "${live}/fullchain.pem" "${live}/chain.pem"
  chmod 644 "${live}/fullchain.pem" "${live}/chain.pem"
  chmod 600 "${live}/privkey.pem"
  touch "${live}/.self-signed"

  echo "[ssl-fallback] Self-signed certificate installed for ${domain}"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  ensure_self_signed_cert
fi

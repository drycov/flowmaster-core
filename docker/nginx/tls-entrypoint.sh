#!/bin/bash
set -eo pipefail

: "${DEBUG:=0}"
: "${STAGING:=0}"
: "${USE_LOCAL_CA:=0}"

. /scripts/util.sh

if [ ! -x /scripts/run_certbot.orig.sh ]; then
  cp /scripts/run_certbot.sh /scripts/run_certbot.orig.sh
fi
cp /etc/nginx/ensure-self-signed-cert.sh /scripts/ensure-self-signed-cert.sh
cp /etc/nginx/run-certbot-with-fallback.sh /scripts/run_certbot.sh
chmod +x /scripts/run_certbot.sh /scripts/ensure-self-signed-cert.sh

# Image redirector 301s all HTTP → HTTPS; breaks bootstrap when LE/443 is down.
rm -f /etc/nginx/conf.d/redirector.conf

. /scripts/ensure-self-signed-cert.sh
ensure_self_signed_cert

envsubst '${PROXY_DOMAIN}' < /etc/nginx/flowmaster-nginx.conf.tpl > /etc/nginx/user_conf.d/flowmaster.conf

symlink_user_configs
/scripts/create_dhparams.sh || true
auto_enable_configs

exec /scripts/start_nginx_certbot.sh

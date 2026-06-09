#!/usr/bin/env sh
# Internal hooks runner for Docker sidecar or manual cron.
# Env: APP_URL, CRON_SECRET (required), CRON_INTERVAL_SEC, RUN_ONCE, ENABLE_TELEGRAM_POLL

set -eu

if command -v apk >/dev/null 2>&1; then
  apk add --no-cache curl >/dev/null 2>&1 || true
fi

: "${APP_URL:=http://app:3000}"
: "${CRON_SECRET:?Set CRON_SECRET}"
: "${CRON_INTERVAL_SEC:=90}"
: "${RUN_ONCE:=0}"
: "${ENABLE_TELEGRAM_POLL:=0}"

auth_hdr="Authorization: Bearer ${CRON_SECRET}"

run_hook() {
  name="$1"
  path="$2"
  if curl -sf -X POST -H "$auth_hdr" "${APP_URL}${path}"; then
    printf '[cron] ok %s\n' "$name"
  else
    printf '[cron] fail %s\n' "$name" >&2
  fi
}

run_batch() {
  run_hook "email-dispatch" "/api/public/hooks/email-dispatch"
  run_hook "webhook-dispatch" "/api/public/hooks/webhook-dispatch"
  run_hook "sla-tick" "/api/public/hooks/sla-tick"
  run_hook "retention-tick" "/api/public/hooks/retention-tick"
  run_hook "license-sync" "/api/public/hooks/license-sync"
  if [ "$ENABLE_TELEGRAM_POLL" = "1" ]; then
    run_hook "telegram-poll" "/api/public/hooks/telegram-poll"
  fi
}

if [ "$RUN_ONCE" = "1" ]; then
  run_batch
  exit 0
fi

printf '[cron] starting loop interval=%ss app=%s\n' "$CRON_INTERVAL_SEC" "$APP_URL"
while true; do
  run_batch
  sleep "$CRON_INTERVAL_SEC"
done

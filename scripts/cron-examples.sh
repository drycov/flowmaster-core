#!/usr/bin/env sh
# Example cron invocations for Flowmaster / ЕСЭДО internal hooks.
# Set APP_URL and CRON_SECRET before use.

: "${APP_URL:=https://esedo.example.kz}"
: "${CRON_SECRET:?Set CRON_SECRET}"

auth="-H Authorization: Bearer ${CRON_SECRET}"

# One-shot (same hooks as Docker cron sidecar):
# RUN_ONCE=1 APP_URL=... CRON_SECRET=... sh scripts/cron-runner.sh

curl -sf -X POST $auth "$APP_URL/api/public/hooks/email-dispatch"
curl -sf -X POST $auth "$APP_URL/api/public/hooks/webhook-dispatch"
curl -sf -X POST $auth "$APP_URL/api/public/hooks/sla-tick"
curl -sf -X POST $auth "$APP_URL/api/public/hooks/retention-tick"
curl -sf -X POST $auth "$APP_URL/api/public/hooks/license-sync"
# Optional when ENABLE_TELEGRAM_POLL=1:
# curl -sf -X POST $auth "$APP_URL/api/public/hooks/telegram-poll"

#!/usr/bin/env sh
# Example cron invocations for Flowmaster / ЕСЭДО.
#
# Internal hooks — set APP_URL and CRON_SECRET.
# Database backup — run from repo root (no secrets required if Docker stack is up).

# --- Host cron (crontab -e) ---
#
# Daily DB backup at 02:00:
#   0 2 * * * cd /opt/edms && npm run backup:db >> /var/log/edms-backup.log 2>&1
#
# Weekly storage archive (Sunday 03:00):
#   0 3 * * 0 cd /opt/edms && npm run backup:db -- --storage >> /var/log/edms-backup.log 2>&1

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

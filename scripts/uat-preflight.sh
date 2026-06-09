#!/usr/bin/env sh
# Pre-UAT checks: health, optional cron hook, E2E hint.
# Usage: APP_URL=http://localhost:3001 CRON_SECRET=... sh scripts/uat-preflight.sh

set -eu

: "${APP_URL:=http://127.0.0.1:3000}"

failures=0

pass() {
  printf '  ok  %s\n' "$1"
}

fail() {
  printf '  FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

printf 'UAT preflight — %s\n\n' "$APP_URL"

printf '1. Health\n'
if curl -sf "${APP_URL}/api/health" | grep -q '"ok"'; then
  pass "GET /api/health"
else
  fail "GET /api/health"
fi

printf '\n2. Cron hook (email-dispatch)\n'
if [ -n "${CRON_SECRET:-}" ]; then
  if curl -sf -X POST -H "Authorization: Bearer ${CRON_SECRET}" \
    "${APP_URL}/api/public/hooks/email-dispatch" >/dev/null; then
    pass "POST email-dispatch"
  else
    fail "POST email-dispatch"
  fi
else
  printf '  skip — set CRON_SECRET to test\n'
fi

printf '\n3. E2E smoke\n'
if [ -n "${E2E_EMAIL:-}" ] && [ -n "${E2E_PASSWORD:-}" ]; then
  printf '  run: E2E_BASE_URL=%s npm run test:e2e\n' "$APP_URL"
else
  printf '  skip — set E2E_EMAIL and E2E_PASSWORD in .env\n'
fi

printf '\n4. Manual UAT\n'
printf '  docs/UAT.md — checklist for acceptance with customer\n'
printf '  docs/STAGING.md — staging environment guide\n'

if [ "$failures" -gt 0 ]; then
  printf '\nPreflight failed (%s check(s)).\n' "$failures"
  exit 1
fi

printf '\nPreflight passed.\n'

#!/usr/bin/env sh
# Production deploy: edms.satory.kz + cloud license (Phase 1)
#
# Run on server (e.g. /opt/edms):
#   chmod +x scripts/deploy-production.sh
#   ./scripts/deploy-production.sh
#
# Options (env):
#   DOMAIN=edms.satory.kz
#   EMAIL=support@satory.kz
#   LICENSE_URL=https://z-edms.vercel.app
#   INSTALLATION_ID=da23803d-1048-4526-b5d8-09c9e95c2999
#   SKIP_PULL=1          skip git pull
#   SKIP_ENV=1           skip env regeneration
#   SKIP_MIGRATE=1       skip docker:migrate

set -eu

DOMAIN="${DOMAIN:-edms.satory.kz}"
EMAIL="${EMAIL:-support@satory.kz}"
LICENSE_URL="${LICENSE_URL:-https://z-edms.vercel.app}"
INSTALLATION_ID="${INSTALLATION_ID:-da23803d-1048-4526-b5d8-09c9e95c2999}"

step() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

command -v npm >/dev/null 2>&1 || fail "npm not found"
command -v docker >/dev/null 2>&1 || fail "docker not found"

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

step "Working directory: $ROOT"

if [ "${SKIP_PULL:-0}" != "1" ]; then
  step "git pull"
  git pull --ff-only
fi

if [ "${SKIP_ENV:-0}" != "1" ]; then
  step "Generate .env (cloud license)"
  npm run env:production -- \
    --domain="$DOMAIN" \
    --email="$EMAIL" \
    --with-license-server \
    --license-server-url="$LICENSE_URL" \
    --installation-id="$INSTALLATION_ID" \
    --force \
    --install
  npm run env:sync
fi

if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  step "Apply database migrations"
  npm run docker:migrate -- --tls
fi

step "Start / update Docker stack (TLS + ONLYOFFICE)"
npm run docker:up -- --tls

step "Enable cron sidecar (license-sync every ~6h)"
npm run docker:up -- --tls --cron

step "Health checks (local nginx)"
if curl -sf "http://127.0.0.1/api/health" >/dev/null; then
  printf '  OK  http://127.0.0.1/api/health\n'
else
  printf '  FAIL http://127.0.0.1/api/health — check: docker compose ps\n' >&2
fi

step "Health checks (public HTTPS)"
if curl -sfk "https://${DOMAIN}/api/health" >/dev/null; then
  curl -sfk "https://${DOMAIN}/api/health"
  printf '\n'
else
  printf '  WARN https://%s/api/health — DNS/TLS or app still starting\n' "$DOMAIN" >&2
fi

step "Cloud license server"
if curl -sf "${LICENSE_URL}/api/v1/license/health" >/dev/null; then
  curl -sf "${LICENSE_URL}/api/v1/license/health"
  printf '\n'
else
  printf '  WARN %s/api/v1/license/health unreachable\n' "$LICENSE_URL" >&2
fi

step "Done"
printf 'Next: open https://%s → Admin → Settings → License → Sync\n' "$DOMAIN"
printf 'Verify installation_id %s is registered on Vercel cabinet/admin\n' "$INSTALLATION_ID"

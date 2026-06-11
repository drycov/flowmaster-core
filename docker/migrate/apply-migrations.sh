#!/bin/sh
# Apply Flowmaster SQL migrations to self-hosted Postgres (idempotent).
set -eu

if [ "${APPLY_DB_MIGRATIONS:-1}" != "1" ]; then
  echo "[migrate] skipped (APPLY_DB_MIGRATIONS=0)"
  exit 0
fi

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

export PGPASSWORD="$DB_PASSWORD"
DB_URL="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

echo "[migrate] waiting for postgres at ${DB_HOST}:${DB_PORT}..."
attempt=0
until psql "$DB_URL" -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 90 ]; then
    echo "[migrate] timeout waiting for postgres"
    exit 1
  fi
  sleep 2
done

echo "[migrate] ensuring migration ledger..."
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
SQL

applied=0
skipped=0

# shellcheck disable=SC2044
for file in $(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -print | LC_ALL=C sort); do
  version=$(basename "$file" .sql)
  exists=$(psql "$DB_URL" -tAc "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$version' LIMIT 1" | tr -d '[:space:]')
  if [ "$exists" = "1" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  echo "[migrate] applying $version"
  if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"; then
    echo "[migrate] FAILED on $version"
    exit 1
  fi
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '$version')"
  applied=$((applied + 1))
done

if [ "${APPLY_DB_SEED:-0}" = "1" ] && [ -f /seed/seed.sql ]; then
  seed_marker="__flowmaster_seed_applied__"
  seeded=$(psql "$DB_URL" -tAc "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$seed_marker' LIMIT 1" | tr -d '[:space:]')
  if [ "$seeded" != "1" ]; then
    echo "[migrate] applying seed.sql"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f /seed/seed.sql
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$seed_marker', 'seed.sql')"
  fi
fi

echo "[migrate] done (applied=$applied skipped=$skipped)"

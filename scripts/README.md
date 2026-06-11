# Scripts

Единая точка входа для env, Docker и UAT. Библиотеки — в `scripts/lib/`.

## Переменные окружения

| Команда | Выход | Описание |
|---------|-------|----------|
| `npm run env:local` | `.env` | Local Docker, nginx, seed |
| `npm run env:production -- --domain=X --email=Y` | `.env.production` | Production HTTPS |
| `npm run env:production -- --domain=X --install` | `.env` | Production → активный env |
| `npm run env:staging` | `.env.staging` | UAT (:8080 nginx); `--install` → `.env` |
| `npm run env:license-server -- --domain=X --install` | `.env` | Vendor license server |
| `npm run env:sync` | `docker/supabase/.env` | Копия root `.env` для Compose |

Шаблон: `.env.docker.example`. Логика профилей: `scripts/lib/env-profiles.mjs`.

Флаги `env-setup`: `--force`, `--rotate-secrets`, `--license-secret=`, `--license-server-url=`, `--dry-run`.

Production генерирует согласованный набор: `APP_URL` / `PROXY_DOMAIN` / Supabase URLs по домену, `ONLYOFFICE_JWT_SECRET` (общий для app и onlyoffice), `ONLYOFFICE_CALLBACK_BASE_URL` / `ONLYOFFICE_STORAGE_INTERNAL_URL` для Docker-сети, `INSTALLATION_ID` по домену.

## Docker

| Команда | Stack | migrate + wait |
|---------|-------|----------------|
| `npm run docker:up` | HTTP prod | да |
| `npm run docker:up -- --tls` | HTTPS prod | да |
| `npm run docker:up -- --cron` | + cron profile | да |
| `npm run docker:deps` | Supabase only (dev) | да |
| `npm run docker:full` | cron + studio + monitoring | да |
| `npm run compose:tls` | = `docker:up --tls` | да |
| `npm run compose:tls:cron` | HTTPS + cron | да |
| `npm run compose:staging` | UAT | да |
| `npm run compose:license-server` | License server | да |

| Остановка | Команда |
|-----------|---------|
| HTTP | `npm run docker:down` |
| HTTPS | `npm run docker:down:tls` |
| Staging | `npm run docker:down:staging` |
| Dev backend | `npm run docker:down:dev` |
| License server | `npm run compose:license-server:down` |

Общая логика: `scripts/lib/docker-orchestrate.mjs` (sync env → up → migrate → restart → wait).

## UAT / лицензии

| Команда | Описание |
|---------|----------|
| `npm run uat:preflight` | Health + cron (bash) |
| `npm run uat:smoke` | Automated smoke |
| `npm run license:generate` | FM1 ключ |
| `npm run license:server` | Register/revoke на license server |

## Cron

- `scripts/cron-runner.sh` — sidecar loop (Docker profile `cron`)
- `scripts/cron-examples.sh` — one-shot curl примеры

## One-off (ручные миграции данных)

Не часть deploy-пайплайна:

- `import-org-csv.mjs`, `import-organization-csv.mjs`, `import-nomenclature-csv.mjs`
- `import-sz-template.mjs`, `verify-template.mjs`

## lib/

| Модуль | Назначение |
|--------|------------|
| `env-profiles.mjs` | Значения профилей env |
| `env-crypto.mjs` | JWT / secrets |
| `env-file.mjs` | Parse / render template |
| `load-env.mjs` | Load `.env` в process.env |
| `sync-supabase-env.mjs` | `.env` → `docker/supabase/.env` |
| `docker-compose-cli.mjs` | Compose `-f` / profiles / stacks |
| `docker-orchestrate.mjs` | up + migrate + wait |

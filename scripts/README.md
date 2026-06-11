# Scripts

**Канонический справочник npm-команд.** Библиотеки — в `scripts/lib/`.

Индекс: [docs/README.md](../docs/README.md). Env-справочник: [docs/ENV.md](../docs/ENV.md). CI: [docs/CI.md](../docs/CI.md).

## `compose:*` vs `docker:*`

| Namespace | Когда использовать |
|-----------|-------------------|
| **`compose:*`** | Deploy-стеки: production TLS, staging, license server |
| **`docker:*`** | Локальная разработка, migrate, down, утилиты |

Дубликаты: `compose:full` = `docker:full`, `compose:tls:down` = `docker:down:tls`, `compose:staging:down` = `docker:down:staging`.

## Переменные окружения

| Команда | Выход | Описание |
|---------|-------|----------|
| `npm run env:local` | `.env` | Local Docker, nginx, **без demo seed** (`APPLY_DB_SEED=0`) |
| `npm run env:production -- --domain=X --email=Y` | `.env.production` | Production HTTPS |
| `npm run env:production -- --domain=X --install` | `.env` | Production → активный env + `env:sync` |
| `npm run env:staging` | `.env.staging` | UAT (:8080 nginx) |
| `npm run env:staging -- --install` | `.env` | Staging → активный env |
| `npm run env:license-server -- --domain=X` | `.env.license-server` | Vendor license server |
| `npm run env:license-server -- --domain=X --install` | `.env` | License server → активный env |
| `npm run env:sync` | `docker/supabase/.env` | Копия root `.env` для Compose |

Шаблон: `.env.docker.example`. Логика профилей: `scripts/lib/env-profiles.mjs`.

### Флаги `env-setup`

| Флаг | Описание |
|------|----------|
| `--force` | Перезаписать существующий файл |
| `--rotate-secrets` | Новые JWT / CRON / ключи |
| `--dry-run` | Показать diff без записи |
| `--install` | Скопировать output → `.env` + sync |
| `--license-secret=` | `LICENSE_SIGNING_SECRET` (FM1) |
| `--license-server-url=` | URL облачного или vendor LS |
| `--installation-id=` | UUID из кабинета Vercel |
| `--with-license-server` | Online-клиент (с `--license-server-url` = облако; без URL = embedded vendor) |
| `--cloud-license` | Alias для облачной связки |
| `--license-domain=` | Домен Local LS (replica) |
| `--license-replica` | Генерация `.env` + `.env.license-server` для Фазы 2 |

Production генерирует согласованный набор: `APP_URL` / `PROXY_DOMAIN` / Supabase URLs, `ONLYOFFICE_JWT_SECRET`, `INSTALLATION_ID` по домену.

## Docker

| Команда | Stack | migrate + wait |
|---------|-------|----------------|
| `npm run docker:up` | HTTP (local / on-prem) | да |
| `npm run docker:up -- --tls` | HTTPS prod | да |
| `npm run docker:up -- --cron` | + cron profile | да |
| `npm run docker:up -- --studio` | + Supabase Studio :54323 | да |
| `npm run docker:up -- --office` | + ONLYOFFICE | да |
| `npm run docker:up -- --monitoring` | + Prometheus/Grafana | да |
| `npm run docker:deps` | Supabase only (host dev) | да |
| `npm run docker:full` | cron + studio + monitoring | да |
| `npm run docker:office` | = `docker:up -- --office` | да |
| `npm run docker:monitoring` | = `docker:up -- --monitoring` | да |
| `npm run compose:tls` | = `docker:up --tls` | да |
| `npm run compose:tls:cron` | HTTPS + cron | да |
| `npm run compose:tls:full` | TLS + cron + studio + monitoring | да |
| `npm run compose:full` | = `docker:full` | да |
| `npm run compose:staging` | UAT | да |
| `npm run compose:license-server` | Vendor license server | да |
| `npm run docker:migrate` | SQL-миграции (HTTP stack) | — |
| `npm run docker:migrate -- --tls` | Миграции TLS stack | — |
| `npm run docker:migrate -- --staging` | Миграции staging | — |
| `npm run docker:wait` | Ждать Kong (после ручного up) | — |
| `npm run docker:repair-stamp` | Починить stamp миграций | — |

| Остановка | Команда |
|-----------|---------|
| HTTP | `npm run docker:down` |
| HTTPS | `npm run docker:down:tls` / `compose:tls:down` |
| Staging | `npm run docker:down:staging` / `compose:staging:down` |
| Dev backend | `npm run docker:down:dev` |
| License server | `npm run compose:license-server:down` |

Общая логика: `scripts/lib/docker-orchestrate.mjs` (sync env → up → migrate → restart → wait).

## Приложение (без Docker)

| Команда | Описание |
|---------|----------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Build в mode development |
| `npm run start` | Preview на :3000 (Docker preview config) |
| `npm run preview` | Vite preview |
| `npm run lint` / `typecheck` / `format` | Качество кода |
| `npm run test` / `test:watch` | Vitest |

## UAT / E2E

| Команда | Описание |
|---------|----------|
| `npm run uat:preflight` | Health + cron (bash) |
| `npm run uat:smoke` | Automated smoke |
| `npm run uat:smoke:db` | DB-only smoke |
| `npm run uat:smoke:full` | Smoke + Playwright E2E |
| `npm run test:e2e` | Playwright |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:install` | Установить Chromium |
| `npm run test:e2e:security` | Health + security routes |

## Лицензии

| Команда | Описание |
|---------|----------|
| `npm run license:generate` | FM1 ключ |
| `npm run license:server` | Register/revoke на license server (CLI) |
| `npm run license:admin` | Локальная Console vendor (`127.0.0.1:3847`, SSH tunnel) |
| `npm run license:support-code` | Support code для Console (Docker vendor) |
| `npm run license:cloud:dev` | Облачный LS — API |
| `npm run license:cloud:web` | Облачный LS — web |
| `npm run license:cloud:build` | Сборка облачного LS |
| `npm run license:cloud:typecheck` | Typecheck облачного LS |
| `npm run license:cloud:support-code` | Support code (облачный LS) |

Скрипты внутри `apps/cloud-license-server` (`vendor-staff:*`, `vendor-telegram:webhook`) — [apps/cloud-license-server/README.md](../apps/cloud-license-server/README.md#npm-scripts).
| `npm run deploy:production` | Shell-деплой (`scripts/deploy-production.sh`) |

## Cron

- `scripts/cron-runner.sh` — sidecar loop (Docker profile `cron`)
- `scripts/cron-examples.sh` — one-shot curl примеры

## One-off (ручные миграции данных)

Не часть deploy-пайплайна:

- `import-org-csv.mjs`, `import-organization-csv.mjs`, `import-nomenclature-csv.mjs`
- `import-sz-template.mjs`, `verify-template.mjs`

## lib/

| Модуль | Назначение |
|--------|----------|
| `env-profiles.mjs` | Значения профилей env |
| `env-crypto.mjs` | JWT / secrets |
| `env-file.mjs` | Parse / render template |
| `load-env.mjs` | Load `.env` в process.env |
| `sync-supabase-env.mjs` | `.env` → `docker/supabase/.env` |
| `docker-compose-cli.mjs` | Compose `-f` / profiles / stacks |
| `docker-orchestrate.mjs` | up + migrate + wait |

См. также: [docs/ENV.md](../docs/ENV.md), [docs/CI.md](../docs/CI.md), [docker/README.md](../docker/README.md), [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md).

# Переменные окружения

Индекс документации: [README.md](./README.md).

Справочник env для **ЕСЭДО** и **облачного license server**. Шаблоны не редактируют вручную — генерируйте через `npm run env:*`.

| Шаблон | Профили |
|--------|---------|
| [.env.docker.example](../.env.docker.example) | `env:local`, `env:production`, `env:staging`, `env:license-server` |
| [.env.example](../.env.example) | Минимальный host dev (без Docker app) |
| [apps/cloud-license-server/.env.example](../apps/cloud-license-server/.env.example) | Vercel / local cloud LS |

Логика генерации: `scripts/lib/env-profiles.mjs`. Флаги CLI: [scripts/README.md](../scripts/README.md).

## Генерация по профилям

| Профиль | Команда | Файл по умолчанию | `--install` |
|---------|---------|-------------------|-------------|
| Local | `npm run env:local` | `.env` | → `.env` + sync |
| Production | `npm run env:production -- --domain=X --email=Y` | `.env.production` | → `.env` + sync |
| Staging | `npm run env:staging` | `.env.staging` | → `.env` + sync |
| License server | `npm run env:license-server -- --domain=X` | `.env.license-server` | → `.env` + sync |

`npm run env:sync` копирует root `.env` → `docker/supabase/.env`.

### Флаги production / license

| Флаг | Эффект на `.env` |
|------|------------------|
| `--with-license-server` | Включить license server (см. ниже) |
| `--license-server-url=URL` | **Облако:** online-клиент → Vercel; `LICENSE_MODE=online`, `LICENSE_SERVER_ENABLED=false` |
| `--installation-id=UUID` | Явный `INSTALLATION_ID` (из кабинета Vercel) |
| `--license-secret=` | `LICENSE_SIGNING_SECRET` (FM1) |
| `--license-domain=` | Домен Local LS (replica или отдельный vendor host) |
| `--license-replica` | Два файла: EDMS `.env` + `.env.license-server` с `LICENSE_UPSTREAM_URL` |
| `--force` / `--rotate-secrets` | Перезапись / новые секреты |

**Три исхода `env:production` с лицензией:**

| Сценарий | Флаги | Результат на EDMS |
|----------|-------|-------------------|
| Облако Vercel | `--with-license-server --license-server-url=https://...` | `LICENSE_MODE=online`, URL = Vercel |
| Embedded vendor (редко) | `--with-license-server` без URL, domain = license domain | `LICENSE_SERVER_ENABLED=true` на том же хосте |
| Replica | `--license-replica --license-domain=... --license-server-url=...` | `LICENSE_SERVER_URL` → local LS |

<a id="supabase-keys"></a>

## Именование Supabase keys

| Контекст | Server | Browser (Vite) |
|----------|--------|----------------|
| **ЕСЭДО** | `SUPABASE_PUBLISHABLE_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| **Self-hosted Supabase compose** | `ANON_KEY`, `SERVICE_ROLE_KEY` | — |
| **Cloud license server** | `SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` |

Все варианты — **anon key** одного типа; не путайте при копировании из Supabase Dashboard.

## ЕСЭДО — приложение

### Публичные URL

| Переменная | Где | Описание |
|------------|-----|----------|
| `APP_URL` | server | Публичный origin (через nginx) |
| `PUBLIC_APP_URL` | server | Alias для ссылок |
| `VITE_SUPABASE_URL` | browser build | Тот же origin в production |
| `SUPABASE_URL` | server | В Docker: `http://kong:8000`; на хосте dev: `:54321` |

### Секреты (только сервер / `.env`, не в git)

| Переменная | Обязательно prod | Описание |
|------------|------------------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | да | Server Functions, обход RLS |
| `SUPABASE_JWT_SECRET` | да | Подпись access JWT (≥32 символов) |
| `CRON_SECRET` | да | Bearer для `/api/public/hooks/*` |
| `INTERNAL_HOOK_SECRET` | альт. | То же назначение, что `CRON_SECRET` (bare-metal) |
| `LICENSE_SIGNING_SECRET` | FM1 / vendor | Подпись ключей `FM1.*` |
| `ONLYOFFICE_JWT_SECRET` | prod + office | Общий с Document Server |

### Auth / сессии

| Переменная | Default | Описание |
|------------|---------|----------|
| `ACCESS_TOKEN_TTL_MINUTES` | 60 | TTL access JWT |
| `APP_SESSION_SECRET` | из JWT | Опциональный override (см. `.env.example`) |

Срок refresh cookie — `session_ttl_hours` в **Настройки → Auth** (в БД).

### Операционные

| Переменная | Production | Описание |
|------------|------------|----------|
| `LOG_LEVEL` | `info` | `debug` на staging |
| `REPLICA_COUNT` | `1` | Число реплик app |
| `DISABLE_TELEGRAM_POLLING` | `true` | При >1 реплике |
| `APPLY_DB_SEED` | `0` | Demo seed после migrate |
| `ENABLE_EMAIL_AUTOCONFIRM` | `false` | Подтверждение email |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | опц. | Error tracking |
| `SENTRY_ENVIRONMENT` | `production` | Тег окружения |

### Multi-tenant

| Переменная | Описание |
|------------|----------|
| `TENANT_BASE_DOMAIN` | `acme.example.kz` → slug `acme` |
| `APP_BASE_DOMAIN` | Алиас |

См. [MULTI-TENANT.md](./MULTI-TENANT.md).

### ONLYOFFICE

| Переменная | Docker default | Описание |
|------------|----------------|----------|
| `ONLYOFFICE_JWT_ENABLED` | `false` local / `true` prod | JWT callback |
| `ONLYOFFICE_JWT_SECRET` | генерируется | Общий app + Document Server |
| `ONLYOFFICE_CALLBACK_BASE_URL` | `http://nginx` | Внутри Docker-сети |
| `ONLYOFFICE_STORAGE_INTERNAL_URL` | `http://kong:8000` | Signed URLs к Storage |
| `ONLYOFFICE_HTTP_PORT` | `8082` | Прямой доступ (отладка) |

Публичный `office_url` — в админке. См. [INTEGRATIONS.md](./INTEGRATIONS.md#onlyoffice).

### Лицензирование (ЕСЭДО)

| Переменная | Offline | Online cloud | Online vendor | Replica EDMS |
|------------|---------|--------------|---------------|--------------|
| `LICENSE_MODE` | `offline` | `online` | `online` | `online` |
| `LICENSE_SERVER_URL` | — | Vercel URL | vendor URL | internal LS URL |
| `INSTALLATION_ID` | опц. | из кабинета | из vendor | из кабинета |
| `LICENSE_SERVER_ENABLED` | `false` | **`false`** | `false` | `false` |
| `LICENSE_UPSTREAM_URL` | — | — | — | только на **Local LS** |
| `LICENSE_SERVER_ADMIN_SECRET` | — | — | на LS only | на LS only |
| `LICENSE_SERVER_LOCAL_ADMIN` | — | — | `npm run license:admin` only | — |

См. [LICENSE-SERVER.md](./LICENSE-SERVER.md), [ARCHITECTURE.md](./ARCHITECTURE.md).

## ЕСЭДО — Docker / nginx

| Переменная | Default | Описание |
|------------|---------|----------|
| `NGINX_HTTP_PORT` | 80 | HTTP |
| `NGINX_HTTPS_PORT` | 443 | HTTPS |
| `STAGING_NGINX_PORT` | 8080 | UAT nginx |
| `STAGING_PORT` | 3001 | UAT app напрямую |
| `PROXY_DOMAIN` | — | Let's Encrypt (TLS compose) |
| `CERTBOT_EMAIL` | — | Email для LE |
| `SSL_SELF_SIGNED_FALLBACK` | 1 | Self-signed если LE недоступен |
| `STUDIO_PORT` | 54323 | Supabase Studio (profile) |

## ЕСЭДО — мониторинг

| Переменная | Default | Описание |
|------------|---------|----------|
| `GRAFANA_PORT` | 3001 | Host port → Grafana |
| `MONITORING_GRAFANA_URL` | `http://127.0.0.1:3001` | Ссылка в UI админки |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | admin / … | Grafana login |
| `PROMETHEUS_PORT` | 9090 | Prometheus |

Profile: `npm run docker:monitoring`. См. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Self-hosted Supabase (docker/supabase)

Генерируются `env:local` / `env:production`. Основные:

| Переменная | Описание |
|------------|----------|
| `POSTGRES_PASSWORD` | Пароль БД |
| `JWT_SECRET` | = `SUPABASE_JWT_SECRET` для stack |
| `ANON_KEY` / `SERVICE_ROLE_KEY` | = publishable / service role в app |
| `SUPABASE_PUBLIC_URL` / `API_EXTERNAL_URL` / `SITE_URL` | Auth redirects |
| `KONG_HTTP_PORT` | 54321 на хосте |
| `POSTGRES_HOST_PORT` | 54322 (pg_dump с хоста) |
| `APPLY_DB_MIGRATIONS` | `1` — auto migrate |
| `POOLER_TENANT_ID` | Идентификатор pooler |

Полный upstream reference: `docker/supabase/CONFIG.md` (vendored).

## Cloud license server (Vercel)

Отдельный Supabase-проект. См. [apps/cloud-license-server/README.md](../apps/cloud-license-server/README.md).

| Переменная | Описание |
|------------|----------|
| `SUPABASE_URL` | URL проекта |
| `SUPABASE_SERVICE_ROLE_KEY` | API server-side |
| `SUPABASE_ANON_KEY` | JWT кабинета |
| `LICENSE_SERVER_ADMIN_SECRET` | Bearer machine API |
| `VENDOR_TELEGRAM_BOT_TOKEN` | Бот вендора (не EDMS) |
| `VENDOR_TELEGRAM_WEBHOOK_SECRET` | Telegram webhook |
| `LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS` | `email:chat_id` |
| `VITE_SUPABASE_*` / `VITE_LICENSE_SERVER_URL` | Build-time для web |

<a id="uat-e2e-ci"></a>

## UAT / E2E / CI (runtime, не в шаблоне)

| Переменная | Использование |
|------------|---------------|
| `APP_URL` | `uat:smoke`, `uat:preflight` |
| `E2E_EMAIL` / `E2E_PASSWORD` | Playwright login |
| `E2E_BASE_URL` | Override base URL |
| `E2E_SKIP_SERVER` | `1` — app уже запущен |
| `E2E_SUPABASE_*` | CI secrets (см. [CI.md](./CI.md)) |

## Настройки в UI (не в `.env`)

Хранятся в `organization.settings`:

- SMTP, LDAP, Telegram bot (EDMS)
- ONLYOFFICE `office_url` (публичный)
- S3, webhooks, API keys
- `app_url` в **Настройки → Общие**

## Безопасность

- Не коммитьте `.env`, `.env.production`, `apps/cloud-license-server/.env`
- `LICENSE_SERVER_ADMIN_SECRET` — только vendor / Vercel, не на клиентском EDMS
- Ротация: `npm run env:production -- --rotate-secrets --force`

См. [SECURITY.md](./SECURITY.md).

# Развёртывание ЕСЭДО (Flowmaster Core)

## Архитектура

- **Single-tenant (по умолчанию):** одна организация на инсталляцию
- **Multi-tenant (SaaS-ready):** несколько изолированных организаций с общей БД, RLS по `organization_id`, вход по slug / поддомену
- **Приложение:** Node.js (TanStack Start + Nitro), порт `3000` (внутри Docker)
- **Reverse proxy:** nginx — единая точка входа `:80` / `:443` (app + Supabase API)
- **БД и API:** Self-hosted Supabase в Docker (PostgreSQL, PostgREST, Storage, Realtime)
- **Файлы:** Supabase Storage (локальный том `docker/supabase/volumes/storage`)

```
                    ┌─────────────┐
  Browser ─────────►│ nginx :443  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
        app:3000 (/ , /api)      kong:8000 (/auth, /rest, /storage, …)
```

## Требования

| Компонент | Минимум |
|-----------|---------|
| Docker + Compose v2 | 24+ |
| Node.js | 22 LTS (только для сборки образа app) |
| RAM | 4 GB (Supabase stack + app + nginx) |
| CPU | 2 vCPU |
| Disk | 20 GB+ |
| DNS | A-запись на сервер (production HTTPS) |

Для LDAP, Telegram polling, ONLYOFFICE — предпочтителен **Node runtime** (не edge-only Workers).

## 1. Docker-стек (рекомендуется)

### Локально / dev-сервер

```bash
npm ci --legacy-peer-deps
npm run env:local          # .env с JWT/ключами Postgres
docker compose up -d --build           # Supabase + migrate + app + nginx
docker compose --profile cron up -d    # outbox, SLA, retention
curl http://localhost/api/health       # через nginx
```

| Сервис | URL / порт |
|--------|------------|
| ЕСЭДО (nginx) | `http://localhost` (`NGINX_HTTP_PORT`, по умолчанию 80) |
| ЕСЭДО (напрямую) | `http://localhost:3000` |
| Supabase API (Kong) | `http://localhost:54321` |
| Postgres (localhost) | `127.0.0.1:54322` |
| Studio (опционально) | `docker compose --profile studio up -d` |

### Production on-prem (HTTPS)

```bash
npm run docker:setup:production -- --domain=esedo.example.kz --email=admin@example.kz --install
docker compose -f docker-compose.tls.yml up -d --build
docker compose --profile cron up -d
curl https://esedo.example.kz/api/health
```

После смены `VITE_SUPABASE_URL` или `APP_URL` — **пересоберите** образ app (`--build`).

Миграции из `supabase/migrations/` применяются сервисом `db-migrate` при первом запуске.
После добавления новых миграций:

```bash
npm run docker:migrate
docker compose up -d app
```

Шаблоны переменных:

| Файл | Назначение |
|------|------------|
| `.env.docker.example` | Локальный Docker |
| `.env.production.example` | Production (домен, nginx, SMTP) |
| `.env.production` | Сгенерированный env (gitignored) |

Supabase Docker vendored в `docker/supabase/`. Nginx-конфиги: `docker/nginx/`.

### Облачный Supabase (альтернатива)

Если БД остаётся в Supabase Cloud — поднимайте только app (+ внешний nginx):

```bash
cp .env.production.example .env
# SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_URL=https://your-domain
npm run build && npm run start
```

Для cloud-only миграции:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## 2. Переменные окружения

### Генерация

| Команда | Результат |
|---------|-----------|
| `node scripts/env-setup.mjs local` | `.env` — localhost, `APPLY_DB_SEED=1` |
| `npm run env:production -- --domain=X --email=Y` | `.env.production` |
| `… --install` | копирует в `.env` |

### Обязательные (production)

| Переменная | Описание |
|------------|----------|
| `APP_URL` / `PUBLIC_APP_URL` | Публичный HTTPS URL приложения |
| `VITE_SUPABASE_URL` | Тот же URL (единый домен через nginx) |
| `SUPABASE_PUBLIC_URL` / `API_EXTERNAL_URL` / `SITE_URL` | Публичный URL для Supabase Auth redirects |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (= `ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Только на сервере |
| `SUPABASE_JWT_SECRET` / `JWT_SECRET` | JWT secret (≥32 символов) |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `CRON_SECRET` | Секрет для internal hooks |
| `PROXY_DOMAIN` / `CERTBOT_EMAIL` | HTTPS через `docker-compose.tls.yml` |

### Рекомендуемые (production)

| Переменная | Значение | Описание |
|------------|----------|----------|
| `APPLY_DB_SEED` | `0` | Не применять demo seed |
| `ENABLE_EMAIL_AUTOCONFIRM` | `false` | Подтверждение email |
| `DISABLE_TELEGRAM_POLLING` | `true` | При >1 реплике app |
| `LOG_LEVEL` | `info` | Уровень логов |
| `REPLICA_COUNT` | `1` | Число реплик app |
| `SENTRY_ENVIRONMENT` | `production` | Sentry env tag |

### Опциональные

| Переменная | Описание |
|------------|----------|
| `INSTALLATION_ID` | UUID инсталляции для лицензии |
| `LICENSE_SIGNING_SECRET` | Подпись FM1 ключей |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Error tracking |
| `TENANT_BASE_DOMAIN` | Multi-tenant поддомены |
| `NGINX_HTTP_PORT` | Порт nginx (по умолчанию 80) |

**Внутри Docker app** `SUPABASE_URL` переопределяется на `http://kong:8000` в `docker-compose.yml` — это нормально; браузер использует `VITE_SUPABASE_URL`.

Почта, LDAP, Telegram, S3, ONLYOFFICE — **в админке** (хранятся в `organization.settings`).

**Публичный URL** также задаётся в **Настройки → Общие → app_url** (Telegram webhook, email links).

## 3. Подготовка БД (без Docker / cloud)

```bash
npx supabase start && npx supabase db push
# remote: npx supabase link --project-ref <ref> && npx supabase db push
```

## 4. Сборка и запуск

### Bare metal / VM

```bash
npm ci --legacy-peer-deps
npm run build
npm run start
```

`npm run start` слушает `0.0.0.0:3000`. Перед production — nginx или другой reverse proxy с TLS.

### Docker (HTTP, локально)

```bash
npm run env:local
docker compose up -d --build
```

### Docker (HTTPS, production)

```bash
npm run env:production -- --domain=your.domain.kz --install
docker compose -f docker-compose.tls.yml up -d --build
```

Cron sidecar:

```bash
docker compose --profile cron up -d
```

Supabase Studio:

```bash
docker compose --profile studio up -d
```

### Staging / UAT

```bash
cp .env.staging.example .env
docker compose -f docker-compose.staging.yml up -d --build
APP_URL=http://localhost:8080 CRON_SECRET=... npm run uat:preflight
```

Staging nginx: `http://localhost:8080` (app напрямую: `:3001`). Подробнее: [STAGING.md](./STAGING.md).

### Health check

```bash
curl http://localhost/api/health          # через nginx
curl http://localhost:3000/api/health     # напрямую
```

Ожидается `{"ok":true,"checks":{"app":"ok","database":"ok",...}}`.

## 5. Cron jobs (обязательно)

Все hooks: `Authorization: Bearer <CRON_SECRET>`.

| Endpoint | Интервал | Назначение |
|----------|----------|------------|
| `POST /api/public/hooks/email-dispatch` | 1–2 мин | Email + Telegram outbox |
| `POST /api/public/hooks/webhook-dispatch` | 1–2 мин | Webhook outbox |
| `POST /api/public/hooks/sla-tick` | 5–15 мин | SLA workflow |
| `POST /api/public/hooks/retention-tick` | 1×/сутки | Retention policies |
| `POST /api/public/hooks/license-sync` | каждые 6 ч | Phone-home license server |
| `POST /api/public/hooks/telegram-poll` | опц. | Polling (только 1 реплика) |

Примеры: `scripts/cron-examples.sh`

Docker cron sidecar: `scripts/cron-runner.sh` (profile `cron`).

### Linux crontab (без Docker cron)

```cron
*/2 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/email-dispatch
*/2 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/webhook-dispatch
*/10 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/sla-tick
15 3 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/retention-tick
```

## 6. Reverse proxy (nginx)

### Встроенный nginx (Docker, рекомендуется)

В `docker-compose.yml` сервис `nginx` проксирует:

| Путь | Backend |
|------|---------|
| `/` | `app:3000` |
| `/auth`, `/rest`, `/graphql`, `/realtime/`, `/storage/v1/`, `/functions`, … | `kong:8000` |

Конфиг: `docker/nginx/conf.d/flowmaster.conf`.

**HTTP (локально):** включён по умолчанию, порт `NGINX_HTTP_PORT=80`.

**HTTPS (production):**

```bash
docker compose -f docker-compose.tls.yml up -d --build
```

Override использует `jonasal/nginx-certbot` + `docker/nginx/flowmaster-nginx.conf.tpl`. Kong и app не публикуют порты наружу — только nginx `:80`/`:443`.

Единый URL в `.env`:

```env
APP_URL=https://esedo.example.kz
VITE_SUPABASE_URL=https://esedo.example.kz
SUPABASE_PUBLIC_URL=https://esedo.example.kz
API_EXTERNAL_URL=https://esedo.example.kz
SITE_URL=https://esedo.example.kz
PROXY_DOMAIN=esedo.example.kz
CERTBOT_EMAIL=admin@example.kz
```

### Внешний nginx (bare metal)

Если app и Supabase на одном хосте без Docker-nginx — проксируйте оба upstream:

```nginx
upstream flowmaster_app { server 127.0.0.1:3000; }
upstream flowmaster_kong { server 127.0.0.1:54321; }

server {
  listen 443 ssl http2;
  server_name esedo.example.kz;

  location ~ ^/(auth|rest|graphql|realtime|storage|functions|mcp|sso) {
    proxy_pass http://flowmaster_kong;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://flowmaster_app;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Multi-tenant (wildcard DNS)

1. DNS: `*.example.kz` → IP сервера
2. Env:

```env
TENANT_BASE_DOMAIN=example.kz
```

3. Nginx — wildcard + сохранение `Host`:

```nginx
server {
  listen 443 ssl http2;
  server_name example.kz *.example.kz;
  # … proxy_pass как выше …
}
```

4. **Provisioning:** Администрирование → Настройки → Организации → создать org (slug `acme`)
5. **Вход:** `https://acme.example.kz/auth` или общий домен + поле «Код организации»
6. Отключённая org (`is_active = false`) не принимает новые входы

**Роли:** администраторы первой (primary) организации получают `platform_admin` (`manage_platform`). Администраторы tenant-org — роль `admin` без `manage_platform`.

**Квоты:** опциональный `max_users` на организацию. Пустое значение = без org-лимита.

## 7. Лицензия

### Offline (изолированный контур)

```bash
npm run license:generate -- --plan professional --customer "Организация"
```

Активация: **Администрирование → Настройки → Лицензия**. `LICENSE_MODE=offline` (по умолчанию).

### Online (license server)

**На стороне поставщика:**

```env
LICENSE_SERVER_ADMIN_SECRET=<random>
LICENSE_SIGNING_SECRET=<shared-with-keygen>
```

**На стороне заказчика:**

```env
LICENSE_MODE=online
LICENSE_SERVER_URL=https://license.vendor.kz
PUBLIC_APP_URL=https://esedo.example.kz
```

Cron phone-home каждые 6 ч: `POST /api/public/hooks/license-sync`.

## 8. Backup

| Объект | Метод |
|--------|-------|
| PostgreSQL | `pg_dump` / `docker exec supabase-db pg_dump …` |
| Storage | `docker/supabase/volumes/storage` / tar backup |
| Настройки org | Включены в DB (`organization.settings`) |
| `.env` / `.env.production` | Secrets manager (не в git) |

Рекомендуется: ежедневный snapshot БД + weekly storage.

## 9. Обновление версии

```bash
git pull
npm run docker:migrate          # Docker
# или: npx supabase db push     # cloud
docker compose up -d --build    # пересборка app при смене VITE_*
npm run uat:smoke               # smoke-проверка
```

Проверьте `/api/health` и smoke: login → документ → задача.

## 10. CI/CD

GitHub Actions: `.github/workflows/ci.yml` — lint, test, build.

Деплой — по вашему pipeline (SSH, K8s, Docker registry). Production env генерируйте на сервере, не храните в репозитории.

## 11. Модули приложения

| Модуль | Маршрут | Примечание |
|--------|---------|------------|
| База знаний | `/knowledge` | Статьи, категории, публикация из утверждённых документов |
| Документы | `/documents` | Жизненный цикл, workflow, ЭЦП |
| Администрирование | `/admin` | Пользователи, настройки, аудит |

Права модулей — через RBAC (`knowledge_base`, `documents`, …).

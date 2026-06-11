# Развёртывание ЕСЭДО (Flowmaster Core)

Индекс всей документации: [README.md](./README.md).

## Архитектура

Полное описание компонентов, диаграммы потоков и схем лицензирования: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

Кратко: browser → **nginx** → `app:3000` (UI, `/api`) и `kong:8000` (Supabase Auth/REST/Storage); PostgreSQL + Storage в Docker. Multi-tenant — RLS по `organization_id` ([MULTI-TENANT.md](./MULTI-TENANT.md)).

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

Быстрый старт: [корневой README](../README.md#быстрый-старт-разработка). Compose-файлы: [docker/README.md](../docker/README.md).

### Локально / dev-сервер

```bash
npm run env:local && npm run docker:up
curl http://localhost/api/health
```

Опционально: `--cron`, `--studio` — см. [scripts/README.md](../scripts/README.md).

### Production on-prem (HTTPS)

```bash
npm run env:production -- --domain=esedo.example.kz --email=admin@example.kz --install
npm run compose:tls
npm run compose:tls:cron
curl https://esedo.example.kz/api/health
```

После смены `VITE_SUPABASE_URL` или `APP_URL` — **пересоберите** образ app (`--build`).

Миграции из `supabase/migrations/` применяются сервисом `db-migrate` при первом запуске.
После добавления новых миграций:

```bash
npm run docker:migrate              # HTTP stack (default)
npm run docker:migrate -- --tls     # production TLS
npm run docker:migrate -- --staging # UAT
npm run docker:up -- --tls          # или restart app вручную
```

Шаблон и генерация env:

| Способ | Описание |
|--------|----------|
| `.env.docker.example` | Единый шаблон (reference) |
| `npm run env:local` | Локальный Docker → `.env` |
| `npm run env:production -- --domain=X` | → `.env.production` |
| `npm run env:production -- --install` | → `.env` (production) |
| `npm run env:staging` | UAT → `.env.staging` |
| `npm run env:staging -- --install` | UAT → `.env` (активный) |
| `npm run env:license-server` | Vendor license server |

Legacy `.env.production.example` / `.env.staging.example` — указатели на генератор.

Supabase Docker vendored в `docker/supabase/`. Nginx-конфиги: `docker/nginx/`.

### Облачный Supabase (альтернатива)

Если БД остаётся в Supabase Cloud — поднимайте только app (+ внешний nginx):

```bash
npm run env:production -- --domain=your.domain --install
# или вручную: cp .env.docker.example .env и заполните Supabase Cloud keys
npm run build && npm run start
```

Для cloud-only миграции:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## 2. Переменные окружения

Полный справочник: **[ENV.md](./ENV.md)** (профили, флаги, лицензирование, cloud LS, UAT).

Кратко:

- Шаблон: `.env.docker.example` — генерируйте `npm run env:local` / `env:production` / `env:staging` / `env:license-server`
- `--install` копирует output → `.env` + `npm run env:sync`
- Production обязательно: `APP_URL`, Supabase keys, `CRON_SECRET`, `PROXY_DOMAIN` + `CERTBOT_EMAIL` (TLS)
- В Docker `app`: `SUPABASE_URL=http://kong:8000`; браузер: `VITE_SUPABASE_URL` = публичный nginx URL
- Почта, LDAP, Telegram, S3, ONLYOFFICE URL — **в админке** (`organization.settings`)

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
npm run docker:up
```

### Docker (HTTPS, production)

```bash
npm run env:production -- --domain=your.domain.kz --install
npm run compose:tls
```

Cron sidecar:

```bash
npm run compose:tls:cron
```

Supabase Studio:

```bash
npm run docker:up -- --tls --studio
```

### Staging / UAT

```bash
npm run env:staging
npm run env:sync
npm run compose:staging
APP_URL=http://localhost:8080 npm run uat:preflight
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
0 */6 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/license-sync
```

Replica (Local License Server, не EDMS): `POST /api/public/hooks/license-upstream-sync` — см. [LICENSE-SERVER.md](./LICENSE-SERVER.md#фаза-2-local-license-server-replica--cloud-master).

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
npm run compose:tls
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

Краткая инструкция по инфраструктуре. **Модель данных, RLS, роли и provisioning** — в [MULTI-TENANT.md](./MULTI-TENANT.md).

1. DNS: `*.example.kz` → IP сервера
2. Env:

```env
TENANT_BASE_DOMAIN=example.kz
```

3. Nginx — wildcard + сохранение `Host` (приложение парсит slug из `Host`):

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

**Роли:** primary org → `manage_platform`; tenant admin — только своя org. **Квоты:** `max_users` на org (опционально).

## 7. Лицензия

Полная инструкция: [LICENSE-SERVER.md](./LICENSE-SERVER.md). Облачный деплой: [apps/cloud-license-server/README.md](../apps/cloud-license-server/README.md).

| Схема | Когда | Документация |
|-------|-------|--------------|
| **Offline FM1** | Нет интернета, изолированный контур | ниже |
| **Облако (Vercel)** | On-prem EDMS + облачный LS без Docker у вендора | [LICENSE-SERVER.md — EDMS + Vercel](./LICENSE-SERVER.md#edms-vercel-cloud) |
| **Self-hosted vendor** | License server на VPS поставщика | [LICENSE-SERVER.md — Docker](./LICENSE-SERVER.md#docker-self-hosted) |
| **Replica** | Закрытый контур, EDMS без выхода в интернет | [LICENSE-SERVER.md — Фаза 2](./LICENSE-SERVER.md#replica-phase-2) |

### Offline (изолированный контур)

```bash
npm run license:generate -- --plan professional --customer "Организация"
```

Активация: **Администрирование → Настройки → Лицензия**. `LICENSE_MODE=offline` (по умолчанию).

### Online — облако (Vercel, рекомендуется для новых клиентов)

Клиент **не вводит FM1-ключ**. Полная инструкция: [LICENSE-SERVER.md § EDMS + Vercel](./LICENSE-SERVER.md#edms-vercel-cloud).

Кратко: `env:production --with-license-server --license-server-url=... --installation-id=... --install` → `compose:tls:cron`. На EDMS: `LICENSE_MODE=online`, **без** `LICENSE_SERVER_ENABLED=true`.

Миграции EDMS: [ARCHITECTURE.md § Миграции](./ARCHITECTURE.md#db-migrations).

### Online — self-hosted vendor (Docker)

**На стороне поставщика** (`npm run env:license-server`, см. [LICENSE-SERVER.md](./LICENSE-SERVER.md)):

```env
LICENSE_SERVER_ENABLED=true
LICENSE_SERVER_ADMIN_SECRET=<random>
LICENSE_SIGNING_SECRET=<shared-with-keygen>
```

**На стороне заказчика** (тот же `LICENSE_SIGNING_SECRET`):

```bash
npm run env:production -- --domain=esedo.example.kz \
  --license-secret=<LICENSE_SIGNING_SECRET> \
  --license-server-url=https://license.vendor.kz \
  --install
```

На EDMS: `LICENSE_MODE=online`, `LICENSE_SERVER_URL`, `LICENSE_SERVER_ENABLED=false`.

Cron phone-home каждые 6 ч: `POST /api/public/hooks/license-sync`.

### Replica (закрытый контур)

`npm run env:production -- --license-replica --license-domain=... --license-server-url=...` — см. [LICENSE-SERVER.md § Replica](./LICENSE-SERVER.md#replica-phase-2).

## 8. Backup

| Объект | Метод |
|--------|-------|
| PostgreSQL | `pg_dump` / `docker exec supabase-db pg_dump …` |
| Storage | `docker/supabase/volumes/storage` / tar backup |
| Настройки org | Включены в DB (`organization.settings`) |
| `.env` / `.env.production` | Secrets manager (не в git) |

Рекомендуется: ежедневный snapshot БД + weekly storage.

Процедуры backup/restore, инциденты, откат релиза: **[RUNBOOK.md](./RUNBOOK.md)**.

## 9. Обновление версии

```bash
git pull
npm run docker:migrate
npm run compose:tls          # или npm run docker:up
npm run uat:smoke
```

Проверьте `/api/health` и smoke: login → документ → задача.

## 10. CI/CD

Полная инструкция: **[CI.md](./CI.md)** — GitHub Actions jobs, secrets, smoke-команды, production deploy, чеклист релиза.

Кратко: workflow `.github/workflows/ci.yml` — `build` (всегда) + опциональные `smoke-db`, `e2e`, `smoke-staging` при наличии secrets.

Production на сервере: `env:production --install` → `docker:migrate --tls` → `compose:tls:cron` → `uat:smoke`. Shell: `npm run deploy:production`.

## 11. Модули приложения

| Модуль | Маршрут | Примечание |
|--------|---------|------------|
| База знаний | `/knowledge` | Статьи, категории, публикация из утверждённых документов |
| Документы | `/documents` | Жизненный цикл, workflow, ЭЦП |
| Администрирование | `/admin` | Пользователи, настройки, аудит |

Права модулей — через RBAC (`knowledge_base`, `documents`, …).

---

См. также: [RUNBOOK.md](./RUNBOOK.md), [GLOSSARY.md](./GLOSSARY.md), [ENV.md](./ENV.md), [CI.md](./CI.md), [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [scripts/README.md](../scripts/README.md).

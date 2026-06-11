# ЕСЭДО (Flowmaster Core)

Единая система электронного документооборота для организаций Казахстана: документы, маршруты согласования, ЭЦП (NCALayer), архив, грифы доступа, LDAP, Telegram, REST API v1.

## Возможности

- Жизненный цикл документов: регистрация, версии, workflow, подписи, архив, legal hold
- Роли и права, грифы доступа, временные grants
- Шаблоны DOCX/XLSX, ONLYOFFICE, корреспонденция
- База знаний (регламенты, публикация из утверждённых документов), проекты, контракты, контрагенты
- Уведомления: in-app, email, Telegram
- Интеграции: API keys, webhooks, batch import
- **Multi-tenant (SaaS-ready):** несколько организаций на одной инсталляции, изоляция по `organization_id` + RLS
- Лицензирование on-prem (FM1.*)

## Быстрый старт (разработка)

### Docker (рекомендуется)

Полный стек: PostgreSQL + Supabase API + приложение + nginx.

```bash
npm ci --legacy-peer-deps
npm run env:local    # создаёт .env с секретами
npm run docker:up                # backend → migrate → app → nginx
npm run docker:wait              # дождаться Kong (если нужно отдельно)
```

**Разработка на хосте** (Vite, hot reload) — только backend в Docker:

```bash
npm run env:local
npm run docker:deps              # Supabase + миграции
npm run dev                      # http://localhost:3000
```

| Сервис | URL |
|--------|-----|
| ЕСЭДО (через nginx) | http://localhost (порт `NGINX_HTTP_PORT`, по умолчанию 80) |
| ЕСЭДО (напрямую) | http://localhost:3000 |
| Supabase API (Kong) | http://localhost:54321 |
| Postgres (pg_dump) | 127.0.0.1:54322 |
| Studio | `node scripts/docker-up.mjs --studio` |

Cron: `npm run docker:up -- --cron`

После новых SQL-миграций: `npm run docker:migrate && npm run docker:up`

### Локально без Docker

```bash
npm ci --legacy-peer-deps
cp .env.example .env
# Заполните SUPABASE_URL, ключи и JWT secret

npm run docker:deps    # Supabase в Docker (рекомендуется)
npm run dev
```

Приложение: `http://localhost:3000` (или порт из вывода Vite).

Первый зарегистрированный пользователь получает роль **admin**. Остальные настройки (почта, LDAP, Telegram) — в **Администрирование → Настройки системы**.

### E2E-тесты

```bash
npm run test:e2e:install   # один раз: браузер Chromium
# В .env задайте E2E_EMAIL и E2E_PASSWORD
npm run test:e2e
```

Smoke-сценарий: вход → создание документа с кастомным маршрутом → согласование задачи. Без `E2E_EMAIL`/`E2E_PASSWORD` выполняются только публичные проверки (страница входа, `/api/health`).

## Production

### Docker (on-prem, рекомендуется)

```bash
# Клиент EDMS + облачный license server (Vercel)
npm run env:production -- \
  --domain=edms.satory.kz \
  --email=support@satory.kz \
  --with-license-server \
  --license-server-url=https://z-edms.vercel.app \
  --installation-id=da23803d-1048-4526-b5d8-09c9e95c2999 \
  --install

# Vendor: встроенный license API на том же домене
# npm run env:production -- --domain=edms.satory.kz --with-license-server --install
```

Env: `.env.docker.example` + `npm run env:production`. Подробнее: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Bare metal / VM

```bash
npm run build
npm run start
```

Reverse proxy (nginx) перед приложением обязателен в production — см. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Сервер лицензирования (vendor)

```bash
npm run env:license-server -- --domain=license.example.kz --install
npm run compose:license-server
curl https://license.example.kz/api/v1/license/health
```

Подробнее: [docs/LICENSE-SERVER.md](docs/LICENSE-SERVER.md).

## Документация

| Документ | Описание |
|----------|----------|
| [docs/LICENSE-SERVER.md](docs/LICENSE-SERVER.md) | Сервер лицензирования (vendor) |
| [docs/MULTI-TENANT.md](docs/MULTI-TENANT.md) | Multi-tenant: модель, изоляция, provisioning |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Развёртывание, env, nginx, cron, backup |
| [docs/SECURITY.md](docs/SECURITY.md) | Аутентификация, RLS, hardening |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | API v1, webhooks, LDAP, Telegram |
| [docs/STAGING.md](docs/STAGING.md) | Staging / UAT окружение |
| [docs/UAT.md](docs/UAT.md) | Чеклист приёмочного тестирования |
| [docs/api-v1.yaml](docs/api-v1.yaml) | OpenAPI спецификация REST API |
| [docker/README.md](docker/README.md) | Docker Compose, nginx, профили |

## Скрипты

Полный список: [scripts/README.md](scripts/README.md).

### Docker: `compose:*` vs `docker:*`

| Namespace | Назначение | Примеры |
|-----------|------------|---------|
| **`compose:*`** | Deploy-стеки (production, staging, license server) | `compose:tls`, `compose:staging`, `compose:license-server` |
| **`docker:*`** | Локальная разработка и утилиты | `docker:up`, `docker:deps`, `docker:migrate`, `docker:down` |

Некоторые команды дублируются (`compose:full` = `docker:full`, `compose:tls:down` = `docker:down:tls`) — используйте один namespace в скриптах CI/CD.

| Команда | Назначение |
|---------|------------|
| `npm run env:local` / `env:production` / `env:staging` / `env:license-server` | Генерация env |
| `npm run env:staging -- --install` | UAT env → активный `.env` |
| `npm run env:sync` | `.env` → `docker/supabase/.env` |
| `npm run docker:up` | HTTP stack + migrate + wait |
| `npm run compose:tls` / `compose:tls:cron` | HTTPS production |
| `npm run compose:staging` | UAT stack |
| `npm run compose:license-server` | Vendor license server |
| `npm run docker:migrate` / `docker:migrate -- --tls` | SQL-миграции (stack-aware) |
| `npm run docker:deps` | Supabase only (host dev) |
| `npm run docker:full` | cron + studio + monitoring |
| `npm run docker:down` / `docker:down:tls` / `docker:down:staging` | Остановка stack |
| `npm run uat:smoke` / `uat:preflight` | UAT checks |
| `npm run license:generate` / `license:server` | FM1 keys / vendor API |
| `npm run dev` / `build` / `start` / `test` / `test:e2e` | App lifecycle |

## Стек

- **Frontend/SSR:** React 19, TanStack Start/Router/Query, Tailwind 4, shadcn/ui
- **Backend:** Server Functions + Nitro, PostgreSQL (self-hosted Supabase в Docker)
- **Reverse proxy:** nginx (встроен в Compose; TLS через `docker-compose.tls.yml`)
- **Auth:** Email, LDAP, ЭЦП (NCALayer), Telegram (custom sessions + RLS)
- **UI:** единая дизайн-система (`src/lib/design-tokens.ts`) — auth и приложение

## Лицензия

Проприетарное ПО. Активация ключа `FM1.*` в разделе **Настройки → Лицензия**.

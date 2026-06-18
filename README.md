# ЕСЭДО (Flowmaster Core)

Единая система электронного документооборота для организаций Казахстана: документы, маршруты согласования, ЭЦП (NCALayer), архив, грифы доступа, LDAP, Telegram, REST API v1.

**Быстрый старт:** [docs/QUICKSTART.md](docs/QUICKSTART.md) · **Wiki:** [wiki/Home.md](wiki/Home.md) · **Документация:** [docs/README.md](docs/README.md) · **Changelog:** [CHANGELOG.md](CHANGELOG.md)

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
| Studio | `npm run docker:up -- --studio` |

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
npm run test:e2e:ui   # Playwright UI mode
```

Smoke-сценарий: вход → создание документа с кастомным маршрутом → согласование задачи. Без `E2E_EMAIL`/`E2E_PASSWORD` выполняются только публичные проверки (страница входа, `/api/health`).

## Production

### Docker (on-prem, рекомендуется)

```bash
npm run env:production -- \
  --domain=esedo.example.kz \
  --email=admin@example.kz \
  --with-license-server \
  --installation-id=<uuid-from-cabinet> \
  --install
npm run compose:tls:cron
```

Облачная связка EDMS + **z-license** (Vercel): [docs/LICENSE-SERVER.md](docs/LICENSE-SERVER.md). Replica для закрытого контура: `env:license-server` + `compose:license-server` на отдельном VPS.

Env: `.env.docker.example` + `npm run env:production`. Подробнее: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Bare metal / VM

```bash
npm run build
npm run start
```

Reverse proxy (nginx) перед приложением обязателен в production — см. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### License replica (закрытый контур, отдельный VPS)

Не путать с EDMS: локальный license server только как **replica** с `LICENSE_UPSTREAM_URL` → z-license.

## Документация

**Wiki:** [wiki/Home.md](wiki/Home.md) (навигация) · **Полные guides:** [docs/README.md](docs/README.md) (17 файлов + OpenAPI)

| Раздел | Ключевые документы |
|--------|-------------------|
| Старт | [QUICKSTART](docs/QUICKSTART.md), [CONTRIBUTING](docs/CONTRIBUTING.md), [e2e/README](e2e/README.md) |
| Архитектура | [ARCHITECTURE](docs/ARCHITECTURE.md), [GLOSSARY](docs/GLOSSARY.md), [ENV](docs/ENV.md) |
| Эксплуатация | [DEPLOYMENT](docs/DEPLOYMENT.md), [RUNBOOK](docs/RUNBOOK.md), [docker/README](docker/README.md) |
| CI/CD | [CI](docs/CI.md), [CHANGELOG](CHANGELOG.md), [scripts/README](scripts/README.md) |
| Безопасность | [SECURITY](docs/SECURITY.md), [MULTI-TENANT](docs/MULTI-TENANT.md) |
| Интеграции | [INTEGRATIONS](docs/INTEGRATIONS.md), [api-v1.yaml](docs/api-v1.yaml) |
| Лицензии | [LICENSE-SERVER](docs/LICENSE-SERVER.md) · [z-license](https://z-license.vercel.app) |
| Приёмка | [STAGING](docs/STAGING.md), [UAT](docs/UAT.md) |
| Сбои | [TROUBLESHOOTING](docs/TROUBLESHOOTING.md) |

## Скрипты

Полный справочник: **[scripts/README.md](scripts/README.md)** (`env:*`, `docker:*`, `compose:*`, UAT, лицензии, тесты).

Частые команды: `env:local` → `docker:up` (dev); `env:production --install` → `compose:tls:cron` (prod); `compose:staging` (UAT).

## Стек

- **Frontend/SSR:** React 19, TanStack Start/Router/Query, Tailwind 4, shadcn/ui
- **Backend:** Server Functions + Nitro, PostgreSQL (self-hosted Supabase в Docker)
- **Reverse proxy:** nginx (встроен в Compose; TLS через `docker-compose.tls.yml`)
- **Auth:** Email, LDAP, ЭЦП (NCALayer), Telegram (custom sessions + RLS)
- **UI:** единая дизайн-система (`src/lib/design-tokens.ts`) — auth и приложение

## Лицензия

Проприетарное ПО. Активация ключа `FM1.*` в разделе **Настройки → Лицензия**.

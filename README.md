# ЕСЭДО (Flowmaster Core)

Единая система электронного документооборота для организаций Казахстана: документы, маршруты согласования, ЭЦП (NCALayer), архив, грифы доступа, LDAP, Telegram, REST API v1.

## Возможности

- Жизненный цикл документов: регистрация, версии, workflow, подписи, архив, legal hold
- Роли и права, грифы доступа, временные grants
- Шаблоны DOCX/XLSX, ONLYOFFICE, корреспонденция
- База знаний (регламенты, публикация из утверждённых документов), проекты, контракты, контрагенты
- Уведомления: in-app, email, Telegram
- Интеграции: API keys, webhooks, batch import
- Лицензирование on-prem (FM1.*)

## Быстрый старт (разработка)

### Docker (рекомендуется)

Полный стек: PostgreSQL + Supabase API + приложение + nginx.

```bash
npm ci --legacy-peer-deps
node scripts/docker-setup.mjs    # создаёт .env с секретами
npm run docker:up                # backend → migrate → app → nginx
npm run docker:wait              # дождаться Kong (если нужно отдельно)
```

**Разработка на хосте** (Vite, hot reload) — только backend в Docker:

```bash
node scripts/docker-setup.mjs
npm run docker:deps              # Supabase + миграции
npm run dev                      # http://localhost:3000
```

| Сервис | URL |
|--------|-----|
| ЕСЭДО (через nginx) | http://localhost (порт `NGINX_HTTP_PORT`, по умолчанию 80) |
| ЕСЭДО (напрямую) | http://localhost:3000 |
| Supabase API (Kong) | http://localhost:54321 |
| Postgres | 127.0.0.1:54322 |
| Studio | `node scripts/docker-up.mjs --studio` |

Cron: `npm run docker:up -- --cron` или `docker compose --profile cron up -d`

После новых SQL-миграций: `npm run docker:migrate && docker compose restart app`

### Локально без Docker

```bash
npm ci --legacy-peer-deps
cp .env.example .env
# Заполните SUPABASE_URL, ключи и JWT secret

docker compose up -d db kong rest storage realtime auth
# или: npx supabase start && npx supabase db push

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
# 1. Production .env с секретами и доменом
npm run docker:setup:production -- --domain=esedo.example.kz --email=admin@example.kz --install

# 2. HTTPS (Let's Encrypt) + cron
docker compose -f docker-compose.tls.yml up -d --build
docker compose --profile cron up -d

# 3. Проверка
curl https://esedo.example.kz/api/health
```

Шаблоны переменных: `.env.docker.example` (локально), `.env.production.example` (production). Подробнее: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Bare metal / VM

```bash
npm run build
npm run start
```

Reverse proxy (nginx) перед приложением обязателен в production — см. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Документация

| Документ | Описание |
|----------|----------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Развёртывание, env, nginx, cron, backup |
| [docs/SECURITY.md](docs/SECURITY.md) | Аутентификация, RLS, hardening |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | API v1, webhooks, LDAP, Telegram |
| [docs/STAGING.md](docs/STAGING.md) | Staging / UAT окружение |
| [docs/UAT.md](docs/UAT.md) | Чеклист приёмочного тестирования |
| [docs/api-v1.yaml](docs/api-v1.yaml) | OpenAPI спецификация REST API |
| [docker/README.md](docker/README.md) | Docker Compose, nginx, профили |

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Production build |
| `npm run start` | Запуск production (preview) |
| `npm run test` | Unit-тесты (Vitest) |
| `npm run test:e2e` | E2E smoke (Playwright) |
| `npm run docker:setup` | Генерация `.env` для локального Docker |
| `npm run docker:setup:production` | Генерация `.env.production` / `--install` → `.env` |
| `npm run docker:up` | Полный стек: Supabase → migrate → app → nginx |
| `npm run docker:deps` | Только Supabase (для `npm run dev`) |
| `npm run docker:migrate` | Применить SQL-миграции |
| `npm run docker:wait` | Дождаться готовности Kong |
| `npm run compose:staging` | Docker staging (app + cron + nginx) |
| `npm run uat:preflight` | Pre-UAT health/cron checks |
| `npm run uat:smoke` | Smoke: health, DB, migrations |
| `npm run lint` | ESLint |
| `npm run license:generate` | Генерация лицензионного ключа FM1 |

## Стек

- **Frontend/SSR:** React 19, TanStack Start/Router/Query, Tailwind 4, shadcn/ui
- **Backend:** Server Functions + Nitro, PostgreSQL (self-hosted Supabase в Docker)
- **Reverse proxy:** nginx (встроен в Compose; TLS через `docker-compose.tls.yml`)
- **Auth:** Email, LDAP, ЭЦП (NCALayer), Telegram (custom sessions + RLS)
- **UI:** единая дизайн-система (`src/lib/design-tokens.ts`) — auth и приложение

## Лицензия

Проприетарное ПО. Активация ключа `FM1.*` в разделе **Настройки → Лицензия**.

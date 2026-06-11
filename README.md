# ЕСЭДО (Flowmaster Core)

Единая система электронного документооборота для организаций Казахстана: документы, маршруты согласования, ЭЦП (NCALayer), архив, грифы доступа, LDAP, Telegram, REST API v1.

## Возможности

- Жизненный цикл документов: регистрация, версии, workflow, подписи, архив, legal hold
- Роли и права, грифы доступа, временные grants
- Шаблоны DOCX/XLSX, ONLYOFFICE, корреспонденция
- База знаний, проекты, контракты, контрагенты
- Уведомления: in-app, email, Telegram
- Интеграции: API keys, webhooks, batch import
- Лицензирование on-prem (FM1.*)

## Быстрый старт (разработка)

### Docker (рекомендуется)

Полный стек: PostgreSQL + Supabase API + приложение.

```bash
npm ci --legacy-peer-deps
node scripts/docker-setup.mjs    # создаёт .env с секретами
docker compose up -d --build     # первый запуск ~3–5 мин
```

- Приложение: `http://localhost:3000`
- Supabase API: `http://localhost:54321`
- Postgres (отладка): `127.0.0.1:54322`
- Studio (опционально): `docker compose --profile studio up -d` → `http://localhost:54321` (Basic Auth)

Миграции применяются автоматически при первом старте. После добавления новых SQL-файлов:

```bash
docker compose run --rm db-migrate
docker compose up -d app
```

### Локально без Docker

```bash
# 1. Зависимости
npm ci --legacy-peer-deps

# 2. Переменные окружения
cp .env.example .env
# Заполните SUPABASE_URL, ключи и JWT secret

# 3. Supabase (локально через CLI или Docker-стек)
docker compose up -d db kong rest storage realtime auth
# или: npx supabase start && npx supabase db push

# 4. Запуск
npm run dev
```

Приложение: `http://localhost:3000` (или порт из вывода Vite).

Первый зарегистрированный пользователь получает роль **admin**. Остальные настройки (почта, LDAP, Telegram) — в **Администрирование → Настройки системы**.

### E2E-тесты

```bash
npm run test:e2e:install   # один раз: браузер Chromium
# В .env задайте E2E_EMAIL и E2E_PASSWORD (пользователь с правами создания и согласования)
npm run test:e2e
```

Smoke-сценарий: вход → создание документа с кастомным маршрутом → согласование задачи. Без `E2E_EMAIL`/`E2E_PASSWORD` выполняются только публичные проверки (страница входа, `/api/health`).

## Production

```bash
npm run build
npm run start
```

Подробнее: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

Docker (production on-prem):

```bash
node scripts/docker-setup.mjs
docker compose up -d --build
docker compose --profile cron up -d   # фоновые задачи
```

## Документация

| Документ | Описание |
|----------|----------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Развёртывание, env, cron, backup |
| [docs/SECURITY.md](docs/SECURITY.md) | Аутентификация, RLS, hardening |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | API v1, webhooks, LDAP, Telegram |
| [docs/STAGING.md](docs/STAGING.md) | Staging / UAT окружение |
| [docs/UAT.md](docs/UAT.md) | Чеклист приёмочного тестирования |
| [docs/api-v1.yaml](docs/api-v1.yaml) | OpenAPI спецификация REST API |

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Production build |
| `npm run start` | Запуск production (preview) |
| `npm run test` | Unit-тесты (Vitest) |
| `npm run test:e2e` | E2E smoke (Playwright) |
| `npm run docker:setup` | Генерация `.env` для Docker-стека |
| `npm run docker:up` | Docker: Supabase + app |
| `npm run compose:staging` | Docker staging (app + cron) |
| `npm run uat:preflight` | Pre-UAT health/cron checks |
| `npm run lint` | ESLint |
| `npm run license:generate` | Генерация лицензионного ключа FM1 |

## Стек

- **Frontend/SSR:** React 19, TanStack Start/Router/Query, Tailwind 4
- **Backend:** Server Functions + Nitro, PostgreSQL (self-hosted Supabase в Docker)
- **Auth:** Email, LDAP, ЭЦП, Telegram (custom sessions + RLS)

## Лицензия

Проприетарное ПО. Активация ключа `FM1.*` в разделе **Настройки → Лицензия**.

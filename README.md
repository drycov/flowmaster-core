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

```bash
# 1. Зависимости
npm ci --legacy-peer-deps

# 2. Переменные окружения
cp .env.example .env
# Заполните SUPABASE_URL, ключи и JWT secret

# 3. Миграции БД (Supabase CLI)
npx supabase db push

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

Docker:

```bash
docker compose up -d --build
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
| `npm run compose:staging` | Docker staging (app + cron) |
| `npm run uat:preflight` | Pre-UAT health/cron checks |
| `npm run lint` | ESLint |
| `npm run license:generate` | Генерация лицензионного ключа FM1 |

## Стек

- **Frontend/SSR:** React 19, TanStack Start/Router/Query, Tailwind 4
- **Backend:** Server Functions + Nitro, PostgreSQL (Supabase)
- **Auth:** Email, LDAP, ЭЦП, Telegram (custom sessions + RLS)

## Лицензия

Проприетарное ПО. Активация ключа `FM1.*` в разделе **Настройки → Лицензия**.

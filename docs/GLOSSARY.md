# Глоссарий

Индекс документации: [README.md](./README.md).

Термины ЕСЭДО (Flowmaster Core), лицензирования и инфраструктуры.

## Продукт и репозиторий

| Термин | Значение |
|--------|----------|
| **ЕСЭДО** | Пользовательское название системы электронного документооборота (Казахстан) |
| **Flowmaster Core** | Техническое имя монорепозитория и Docker-стека |
| **EDMS** | Electronic Document Management System — англоязычное обозначение в архитектурных диаграммах |
| **Cloud license server** | Проект [z-license](https://z-license.vercel.app) на Vercel: API + сайт + кабинет (отдельный репозиторий) |
| **Self-hosted Supabase** | PostgreSQL + Kong + PostgREST + Storage в Docker (`docker/supabase/`) |

## Организации и multi-tenant

| Термин | Значение |
|--------|----------|
| **Organization (org)** | Строка в таблице `organization` — юридическое/логическое подразделение системы |
| **Tenant** | Организация в режиме multi-tenant; изоляция по `organization_id` |
| **Single-tenant** | Одна org на инсталляцию (`tenant_mode = 'single'`) |
| **Multi-tenant** | Несколько org на одной БД и одном app |
| **Slug** | Код org (`acme`) для входа и поддомена `acme.example.kz` |
| **Platform admin** | Пользователь primary org с правом `manage_platform` |
| **RLS** | Row Level Security в PostgreSQL — фильтр строк по `organization_id` |
| **Provisioning** | Создание новой org (Администрирование → Организации) |

См. [MULTI-TENANT.md](./MULTI-TENANT.md).

## Аутентификация и доступ

| Термин | Значение |
|--------|----------|
| **Access JWT** | Короткоживущий токен в `localStorage` для Supabase RPC |
| **Refresh token** | HttpOnly cookie `fm_refresh` — продление сессии |
| **RBAC** | Роли (admin, registrar, approver, …) + 19 permissions |
| **Гриф доступа** | `access_level_id` — уровень секретности документа |
| **Grant** | Временный доступ к документу (`document_access_grants`) |
| **ЭЦП / NCALayer** | Электронная подпись НУЦ РК |
| **API key** | Ключ интеграции `fm_*` с scopes |

См. [SECURITY.md](./SECURITY.md).

## Лицензирование

| Термин | Значение |
|--------|----------|
| **FM1.\*** | Проприетарный лицензионный ключ (HMAC-SHA256), offline-режим |
| **installation_id** | UUID инсталляции EDMS; для облака — из кабинета Vercel |
| **Provision** | Регистрация `installation_id` на license server |
| **Connect** | `POST /api/v1/license/connect` — автоподключение EDMS по `installation_id` |
| **Heartbeat** | Phone-home: синхронизация лицензии и телеметрии |
| **Entitlement** | Права лицензии (план, лимиты, срок) |
| **Trial** | Пробный период при регистрации в `/register` |
| **Replica (Local LS)** | License server у клиента с upstream на облако vendor |
| **Upstream** | Облачный master (Vercel), `LICENSE_UPSTREAM_URL` на Local LS |
| **Grace period** | Read-only после потери sync (`offline_grace_hours`, ~72 ч) |
| **Телеметрия** | Агрегированные метрики в heartbeat (без ПДн) |

### Интерфейсы вендора (не для клиентов)

| Термин | Где | Вход |
|--------|-----|------|
| **Кабинет** | Vercel `/cabinet` | Email + пароль **клиента** |
| **Cloud Admin** | Vercel `/admin` | Email + пароль **сотрудника вендора** + Telegram/webhook |
| **Console** | Local `127.0.0.1:3847/vendor/license` | Support code + SSH tunnel |
| **Machine API** | `/api/v1/license/*` (admin) | Bearer `LICENSE_SERVER_ADMIN_SECRET` |

### Боты Telegram

| Термин | Env | Назначение |
|--------|-----|------------|
| **Бот EDMS** | `TELEGRAM_BOT_TOKEN` | Уведомления и вход клиента в ЕСЭДО |
| **Бот вендора** | `VENDOR_TELEGRAM_BOT_TOKEN` | Step-up verify Cloud Admin |

См. [LICENSE-SERVER.md](./LICENSE-SERVER.md).

## Инфраструктура

| Термин | Значение |
|--------|----------|
| **nginx** | Reverse proxy — единый origin для app и Supabase API |
| **Kong** | API gateway Supabase (`:8000` внутри Docker) |
| **PostgREST** | REST-слой к PostgreSQL (`/rest/v1/`) |
| **db-migrate** | Compose-сервис: применяет `supabase/migrations/` |
| **Cron sidecar** | Контейнер `cron-runner.sh`, profile `cron` |
| **Profile (Compose)** | Опциональные сервисы: `cron`, `office`, `studio`, `monitoring` |
| **compose:\*** | Deploy-стеки (TLS, staging, license server) |
| **docker:\*** | Локальная разработка и утилиты |

См. [ARCHITECTURE.md](./ARCHITECTURE.md), [docker/README.md](../docker/README.md).

## Роли в проекте

| Термин | Кто |
|--------|-----|
| **Заказчик / клиент** | Организация, эксплуатирующая on-prem EDMS |
| **Вендор / поставщик** | Zeus — владелец license server и FM1-ключей |
| **Platform admin** | Админ SaaS-инсталляции (все tenant) |
| **Tenant admin** | Админ одной организации |

## Сокращения

| Сокращение | Расшифровка |
|------------|-------------|
| **UAT** | User Acceptance Testing — приёмочное тестирование |
| **RLS** | Row Level Security |
| **RBAC** | Role-Based Access Control |
| **LS** | License Server |
| **SSR** | Server-Side Rendering (TanStack Start) |
| **КИИ** | Критическая информационная инфраструктура |

## Связанные документы

| Документ | Тема |
|----------|------|
| [ENV.md](./ENV.md) | Имена переменных окружения |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Диаграммы и потоки |
| [RUNBOOK.md](./RUNBOOK.md) | Операционные процедуры |
| [QUICKSTART.md](./QUICKSTART.md) | Первый запуск за 5 минут |
| [CHANGELOG.md](../CHANGELOG.md) | История релизов |

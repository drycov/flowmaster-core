# FlowMaster Cloud License Server

Отдельный serverless-сервис для **Vercel**: API лицензирования + **маркетинговый сайт** + **личный кабинет клиента**.

## Что на сайте

| Раздел | URL | Описание |
|--------|-----|----------|
| Landing | `/` | Презентация ЕСЭДО, возможности, тарифы |
| Регистрация | `/register` | Пробный период 30 дней |
| Кабинет | `/cabinet` | installation_id, статус лицензии, инструкция `.env` |
| Cloud Admin | `/admin` | Email + пароль вендора → verify (Telegram / webhook) |
| Cloud Admin (рабочая область) | `/admin/app` | Управление облачным сервером: установки, клиенты, FM1 |
| API | `/api/v1/license/*` | Подключение клиентских EDMS |

## Стек

- **Hono** — API на Vercel (`api/index.ts`)
- **React + Vite + Tailwind** — landing и кабинет (`web/`)
- **Supabase Auth** — вход клиентов в кабинет
- **Supabase DB** — license_server_* + portal_accounts

## Быстрый старт (локально)

```bash
cd apps/cloud-license-server
cp .env.example .env
# заполните переменные

npm install

# Терминал 1 — API :3848
npm run dev

# Терминал 2 — сайт :5173 (прокси /api → API)
npm run dev:web
```

Откройте http://127.0.0.1:5173

## База данных

1. Отдельный проект Supabase (не БД клиента EDMS).
2. **Authentication → Providers → Email** — включить; для dev можно отключить confirm email.
3. SQL Editor:
   - `supabase/migrations/001_license_server_schema.sql`
   - `supabase/migrations/002_portal_accounts.sql`

## Деплой на Vercel

1. Root Directory: `apps/cloud-license-server`
2. Environment Variables (Production):

| Переменная | Где используется |
|------------|------------------|
| `SUPABASE_URL` | API |
| `SUPABASE_SERVICE_ROLE_KEY` | API |
| `SUPABASE_ANON_KEY` | API (проверка JWT кабинета) |
| `LICENSE_SERVER_ADMIN_SECRET` | Machine API (Bearer, CI/скрипты) |
| `LICENSE_SERVER_VENDOR_ADMIN_EMAILS` | Cloud Admin — allowlist email |
| `VENDOR_TELEGRAM_BOT_TOKEN`, `LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS` | Step-up verify — **отдельный бот вендора** |
| `LICENSE_SERVER_VENDOR_ADMIN_APPROVAL_WEBHOOK_URL` | Step-up verify через webhook |
| `VITE_SUPABASE_URL` | Landing / кабинет (или дублируйте `SUPABASE_URL`) |
| `VITE_SUPABASE_ANON_KEY` | Landing / кабинет (или дублируйте `SUPABASE_ANON_KEY`) |
| `VITE_LICENSE_SERVER_URL` | Кабинет (подсказка LICENSE_SERVER_URL) |
| `VITE_SALES_EMAIL` | CTA «Связаться с продажами» |

3. Deploy → клиенты указывают `LICENSE_SERVER_URL=https://xxx.vercel.app`

На Vercel для **сборки** фронта нужны **оба** значения: `SUPABASE_URL` **и** `SUPABASE_ANON_KEY` (или явные `VITE_SUPABASE_*`). Если задан только URL — регистрация покажет «Supabase не настроен». После смены env — **Redeploy** (переменные вшиваются при `npm run build`).

**Troubleshooting:** в Vercel → Settings → Environment Variables убедитесь, что `SUPABASE_ANON_KEY` (или `VITE_SUPABASE_ANON_KEY`) включён для **Production** и **Preview**, scope **Build** (по умолчанию — все окружения).

## Поток клиента

1. Регистрация на сайте → onboarding → создаётся trial provision + `installation_id`
2. В кабинете копирует `INSTALLATION_ID` и `LICENSE_SERVER_URL`
3. Добавляет в `.env` EDMS — лицензия подключается автоматически через `/connect`

## Cloud Admin (только для вендора)

**Не для клиентов** — клиенты используют `/cabinet`.

| Интерфейс | Где | URL | Вход |
|-----------|-----|-----|------|
| **Console** | Локальный license server (SSH + tunnel) | `http://127.0.0.1:3847/vendor/license` | **Support code** + `npm run license:admin` |
| **Admin** | Облако (Vercel, этот проект) | `/admin` → `/admin/verify` → `/admin/app` | **Email + пароль** + **Telegram** или **webhook** |

### Настройка Cloud Admin

**Шаг 1 — учётные записи вендора**

1. Supabase **Authentication → Users** — создайте email + пароль для сотрудников.
2. Env allowlist:

```env
LICENSE_SERVER_VENDOR_ADMIN_EMAILS=admin@vendor.kz,ops@vendor.kz
```

**Шаг 2 — второй фактор (хотя бы один в production)**

**Telegram — отдельный бот вендора** (не путать с ботом EDMS у клиента; создайте через @BotFather):

```env
VENDOR_TELEGRAM_BOT_TOKEN=...
VENDOR_TELEGRAM_BOT_USERNAME=zeus_vendor_admin_bot
VENDOR_TELEGRAM_WEBHOOK_SECRET=random-secret
LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS=admin@vendor.kz:123456789
```

Webhook (внутренняя система вендора):

```env
LICENSE_SERVER_VENDOR_ADMIN_APPROVAL_WEBHOOK_URL=https://internal.vendor.kz/hooks/admin-verify
LICENSE_SERVER_VENDOR_ADMIN_APPROVAL_SECRET=shared-secret
```

При старте verify сервер шлёт POST на webhook `{ event, challenge_token, email, user_id, expires_at }`.
Подтверждение: `POST /api/v1/admin/verify/approve` с `{ challenge_token, secret }`.

Telegram webhook (после деплоя):

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-project.vercel.app/api/v1/hooks/telegram","secret_token":"<VENDOR_TELEGRAM_WEBHOOK_SECRET>"}'
```

**Шаг 3 — миграции**

SQL Editor: `004_vendor_admin_verify.sql` (в дополнение к `001`–`003`).

**Поток входа:** `/admin` (email + пароль) → `/admin/verify` (Telegram или webhook) → `/admin/app`.

Если Telegram и webhook **не** настроены — после пароля доступ сразу (удобно для dev).

**На Vercel (production):**

| URL | Назначение |
|-----|------------|
| `https://your-project.vercel.app/admin` | Email + пароль |
| `https://your-project.vercel.app/admin/verify` | Подтверждение Telegram / webhook |
| `https://your-project.vercel.app/admin/app` | Cloud Admin |

После деплоя с `vercel.json` (SPA rewrite) работают прямые ссылки и обновление страницы на `/admin`, `/admin/app/*`, `/cabinet` и т.д.

Разделы админки:
- **Обзор** — KPI, trial на исходе, последние клиенты
- **Клиенты** — аккаунты личного кабинета
- **Установки** — provision, телеметрия, отзыв
- **Активации** — phone-home от EDMS
- **Ключи FM1** — legacy
- **Инструменты** — pre-register FM1, machine API

Для CI/скриптов Bearer API (`/api/v1/license/provision`, …) — `LICENSE_SERVER_ADMIN_SECRET`, не для браузера.

## API (кратко)

См. предыдущие разделы README + новые portal routes:

| Метод | Путь | Auth |
|-------|------|------|
| GET | `/api/v1/portal/plans` | — |
| GET | `/api/v1/portal/pricing-config` | — |
| POST | `/api/v1/portal/pricing-quote` | — |
| GET | `/api/v1/portal/me` | Supabase JWT |
| POST | `/api/v1/portal/bootstrap` | Supabase JWT |

Admin UI (`/api/v1/admin/*`) — Supabase JWT + allowlist + verify cookie (Telegram/webhook).
Machine API (`/api/v1/license/provision`, …) — Bearer `LICENSE_SERVER_ADMIN_SECRET`.

См. также: [docs/LICENSE-SERVER.md](../../docs/LICENSE-SERVER.md)

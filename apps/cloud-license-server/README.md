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
| `VENDOR_TELEGRAM_BOT_TOKEN`, `LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS` | **Отдельный бот вендора**: привязка `email:telegram_chat_id`, bootstrap owner, step-up verify |
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

**Шаг 1 — таблица `vendor_staff` (миграция `005_vendor_staff.sql`)**

Первый owner создаётся автоматически из `LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS` (первый `email:chat_id`), пароль приходит в **Telegram DM** от vendor-бота. Срабатывает при первом запросе к API или вручную:

```bash
cd apps/cloud-license-server
# API должен быть доступен (local: npm run dev или Vercel)
npm run vendor-staff:bootstrap
```

Если пароль не пришёл или «Invalid login credentials» — сброс и повторная отправка в Telegram:

```bash
npm run vendor-staff:reset-password
```

Пример env:

```env
LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS=d.rykov@zeus.kz:8328036041
VENDOR_TELEGRAM_BOT_TOKEN=...
```

Альтернатива (legacy): `LICENSE_SERVER_VENDOR_ADMIN_EMAILS` — при первом входе email автоматически попадёт в `vendor_staff` без заранее созданного пароля (первый = owner).

**Шаг 2 — второй фактор (Telegram / webhook)**

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

При старте verify сервер шлёт POST **на ваш внутренний** `LICENSE_SERVER_VENDOR_ADMIN_APPROVAL_WEBHOOK_URL` (не на Vercel!) с `{ event, challenge_token, email, user_id, expires_at }`.
Подтверждение inbound: `POST /api/v1/admin/verify/approve` с `{ challenge_token, secret }` — **только POST**, в браузере будет 405 с подсказкой.

Если используете только Telegram — `LICENSE_SERVER_VENDOR_ADMIN_APPROVAL_WEBHOOK_URL` оставьте **пустым**.

Telegram webhook для **@zeus_cloud_bot** (после деплоя на Vercel):

```bash
cd apps/cloud-license-server
npm run vendor-telegram:webhook              # register через Vercel env (рекомендуется)
npm run vendor-telegram:webhook -- --local   # register с локального .env
npm run vendor-telegram:webhook -- --check   # полная проверка
```

API-проверка (Bearer `LICENSE_SERVER_ADMIN_SECRET`):

```bash
curl -s -H "Authorization: Bearer $LICENSE_SERVER_ADMIN_SECRET" \
  https://your-project.vercel.app/api/v1/hooks/telegram/check | jq
```

### 401 на `/api/v1/hooks/telegram`

Telegram шлёт `X-Telegram-Bot-Api-Secret-Token` из `setWebhook`. Значение на **Vercel** (`VENDOR_TELEGRAM_WEBHOOK_SECRET`) должно **совпадать** с тем, что зарегистрировано в Telegram.

1. Vercel → Environment Variables → `VENDOR_TELEGRAM_WEBHOOK_SECRET` (скопировать из `.env`)
2. **Redeploy**
3. `npm run vendor-telegram:webhook` — регистрация **через API Vercel** (secret берётся из runtime env, не из локального `.env`)
4. `npm run vendor-telegram:webhook -- --check` — сравните `secret_len` локально и на Vercel

Лог `secret_ok:false` + `body_preview:{"update_id":0}` — probe/check шлёт secret из `.env`, а на Vercel другой.

URL webhook: `https://your-project.vercel.app/api/v1/hooks/telegram`  
**Не путать** с `/api/v1/admin/verify/approve` — это другой endpoint (approval webhook).

На Vercel должны быть заданы: `VENDOR_TELEGRAM_BOT_TOKEN`, `VENDOR_TELEGRAM_WEBHOOK_SECRET` (тот же secret, что в `setWebhook`).

Ручная регистрация:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-project.vercel.app/api/v1/hooks/telegram","secret_token":"<VENDOR_TELEGRAM_WEBHOOK_SECRET>","allowed_updates":["message"]}'
```

**Шаг 3 — миграции**

SQL Editor: `001` … `005_vendor_staff.sql`.

**Поток входа:** `/admin` → `/admin/verify` → `/admin/app`. Новых сотрудников добавляют owner/admin в разделе **Сотрудники** (создаётся Supabase Auth user + строка в `vendor_staff`).

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
- **Сотрудники** — vendor_staff: создание, роли owner/admin/staff, Telegram chat_id

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

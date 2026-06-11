# FlowMaster Cloud License Server

Отдельный serverless-сервис для **Vercel**: API лицензирования + **маркетинговый сайт** + **личный кабинет клиента**.

## Что на сайте

| Раздел | URL | Описание |
|--------|-----|----------|
| Landing | `/` | Презентация ЕСЭДО, возможности, тарифы |
| Регистрация | `/register` | Пробный период 30 дней |
| Кабинет | `/cabinet` | installation_id, статус лицензии, инструкция `.env` |
| Vendor Admin | `/admin` | Вход по support code (8 цифр, 15 мин) |
| Admin Console | `/admin/console` | Установки, ключи FM1, активации, отзыв |
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
| `LICENSE_SERVER_ADMIN_SECRET` | Admin API |
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

## Vendor Admin UI

Секрет **не вводится в браузер**. Rotating support code + httpOnly cookie (4 ч):

```bash
cd apps/cloud-license-server
# .env с LICENSE_SERVER_ADMIN_SECRET (тот же, что на Vercel)
npm run support-code
```

Откройте `/admin` → введите код → `/admin/console`.

Для CI/скриптов Bearer API (`/api/v1/license/provision`, …) остаётся доступен.

## API (кратко)

См. предыдущие разделы README + новые portal routes:

| Метод | Путь | Auth |
|-------|------|------|
| GET | `/api/v1/portal/plans` | — |
| GET | `/api/v1/portal/pricing-config` | — |
| POST | `/api/v1/portal/pricing-quote` | — |
| GET | `/api/v1/portal/me` | Supabase JWT |
| POST | `/api/v1/portal/bootstrap` | Supabase JWT |

Admin UI session API (`/api/v1/admin/*`) — cookie после `/admin/login`.  
Machine API (`/api/v1/license/provision`, …) — Bearer `LICENSE_SERVER_ADMIN_SECRET`.

См. также: [docs/LICENSE-SERVER.md](../../docs/LICENSE-SERVER.md)

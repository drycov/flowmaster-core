# Cloud License Server

**Полная версия:** [`apps/cloud-license-server/README.md`](../apps/cloud-license-server/README.md)

## Назначение

Serverless на **Vercel**: API + landing + кабинет клиента + Cloud Admin.

| URL | Аудитория |
|-----|-----------|
| `/` | Маркетинг |
| `/register`, `/cabinet` | Клиенты |
| `/admin` | Вендор |
| `/api/v1/license/*` | EDMS phone-home |

## Локальная разработка

```bash
npm run license:cloud:dev    # API :3848
npm run license:cloud:web    # web :5173
```

## Supabase (отдельный проект)

Миграции `001` … `005` в `apps/cloud-license-server/supabase/migrations/`.

## Vercel deploy

- Root Directory: `apps/cloud-license-server`
- Env: `SUPABASE_*`, `LICENSE_SERVER_ADMIN_SECRET`, `VITE_*`, `VENDOR_TELEGRAM_*`

## Cloud Admin

1. `vendor_staff` (миграция 005)
2. Telegram webhook: `npm run vendor-telegram:webhook`
3. Вход: `/admin` → verify → `/admin/app`

## Отдельный бот вендора

`VENDOR_TELEGRAM_BOT_TOKEN` — **не** `TELEGRAM_BOT_TOKEN` EDMS клиента.

→ [Licensing](Licensing) · `docs/LICENSE-SERVER.md`

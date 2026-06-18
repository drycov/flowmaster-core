# z-license (облако)

**Продакшен:** [https://z-license.vercel.app](https://z-license.vercel.app)

Отдельный проект на Vercel — **не** в репозитории `flowmaster-core`. Исходники, миграции Supabase и деплой ведутся в репозитории **z-license**.

## Назначение

Serverless на **Vercel**: API + landing + кабинет клиента + Cloud Admin.

| URL | Аудитория |
|-----|-----------|
| `/` | Маркетинг |
| `/register`, `/cabinet` | Клиенты |
| `/admin` | Вендор |
| `/api/v1/license/*` | EDMS phone-home |

## Связка с EDMS

1. Регистрация в [кабинете](https://z-license.vercel.app/cabinet) → `installation_id`
2. На EDMS: `LICENSE_MODE=online`, `LICENSE_SERVER_URL=https://z-license.vercel.app`, `INSTALLATION_ID`
3. **Не** задавать `LICENSE_SERVER_ENABLED` на EDMS

```bash
npm run env:production -- \
  --domain=esedo.example.kz \
  --with-license-server \
  --installation-id=<uuid> \
  --install
```

## Cloud Admin

Вход: `https://z-license.vercel.app/admin` (email + Telegram step-up).

## Отдельный бот вендора

`VENDOR_TELEGRAM_BOT_TOKEN` на z-license — **не** `TELEGRAM_BOT_TOKEN` EDMS у клиента.

→ [Licensing](Licensing) · [docs/LICENSE-SERVER.md](../docs/LICENSE-SERVER.md)

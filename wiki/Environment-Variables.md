# Переменные окружения

**Полная версия:** [`docs/ENV.md`](../docs/ENV.md)

## Шаблоны

| Файл | Профиль |
|------|---------|
| `.env.docker.example` | `env:local`, `production`, `staging`, `license-server` |
| `.env.example` | host dev |
| z-license (Vercel) | env в отдельном репозитории |

```bash
npm run env:local
npm run env:production -- --domain=X --email=Y --install
npm run env:sync    # → docker/supabase/.env
```

## Ключи Supabase

| Контекст | Имя |
|----------|-----|
| ЕСЭДО | `SUPABASE_PUBLISHABLE_KEY` / `VITE_*` |
| Cloud LS | `SUPABASE_ANON_KEY` / `VITE_*` |

## Production (обязательно)

- `APP_URL`, `VITE_SUPABASE_URL` — один публичный origin
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `CRON_SECRET`
- `PROXY_DOMAIN`, `CERTBOT_EMAIL` (TLS)

## Лицензия (EDMS)

| Сценарий | Ключевые vars |
|----------|---------------|
| Offline | `LICENSE_MODE=offline`, FM1 в UI |
| Cloud | `LICENSE_MODE=online`, `LICENSE_SERVER_URL` → `https://z-license.vercel.app`, `INSTALLATION_ID` |
| Replica | EDMS → local URL; upstream только на Local LS |

**Не** задавать `LICENSE_SERVER_ENABLED=true` на EDMS при облаке Vercel.

## Флаги `env:production`

`--with-license-server` · `--license-server-url=` · `--installation-id=` · `--license-replica`

## В UI (не в .env)

SMTP, LDAP, Telegram, ONLYOFFICE URL, S3 — **Настройки системы**.

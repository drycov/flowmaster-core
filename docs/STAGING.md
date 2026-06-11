# Staging и UAT

Приёмочная среда перед production.

## Быстрый старт

```bash
# 1. Env (UAT-порты, debug, seed) → .env.staging; активировать:
npm run env:staging -- --install
npm run env:sync

# 2. Stack (Supabase + migrate + app + nginx :8080 + cron)
npm run compose:staging

# 3. Preflight
npm run uat:preflight

# 4. Smoke
npm run uat:smoke
```

| URL | Назначение |
|-----|------------|
| `http://localhost:8080` | ЕСЭДО через nginx (UAT) |
| `http://localhost:3001` | App напрямую |
| `http://localhost:54321` | Supabase API (Kong) |

Порты: `STAGING_NGINX_PORT` (8080), `STAGING_PORT` (3001).

## Что входит в staging compose

| Сервис | Назначение |
|--------|------------|
| Supabase stack | db, kong, rest, storage, realtime, auth |
| `db-migrate` | SQL из `supabase/migrations/` |
| `app` | `LOG_LEVEL=debug`, `SENTRY_ENVIRONMENT=staging` |
| `nginx` | Reverse proxy :8080 |
| `cron` | Все hooks (`CRON_INTERVAL_SEC`, по умолчанию 60 с) |

Hooks: `email-dispatch`, `webhook-dispatch`, `sla-tick`, `retention-tick`, `license-sync`, `telegram-poll` (если `ENABLE_TELEGRAM_POLL=1`).

## Подготовка данных

1. `http://localhost:8080/auth` — первый admin
2. **Настройки → Общие** — `app_url`
3. Лицензия FM1 или trial
4. Тестовые пользователи (registrar, approver, viewer)
5. Seed: `APPLY_DB_SEED=1` при первом migrate

## Приёмочное тестирование

Чеклист: [UAT.md](./UAT.md).

```bash
npm run uat:preflight
npm run uat:smoke
npm run uat:smoke:full    # + Playwright E2E
npm run test:e2e:security
```

## Остановка

```bash
npm run compose:staging:down
```

Полный сброс данных:

```bash
docker compose -f docker-compose.staging.yml down -v
rm -rf docker/supabase/volumes/db/data docker/supabase/volumes/storage
```

## Production vs staging

| | Production | Staging |
|---|------------|---------|
| Env | `env:production --install` | `env:staging --install` |
| Up | `compose:tls` + `compose:tls:cron` | `compose:staging` |
| HTTPS | Let's Encrypt | HTTP :8080 |
| Cron | profile `cron` | always on |
| Seed | `APPLY_DB_SEED=0` | `APPLY_DB_SEED=1` |
| Логи | `info` | `debug` |

Production: [DEPLOYMENT.md](./DEPLOYMENT.md).

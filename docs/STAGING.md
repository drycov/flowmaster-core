# Staging и UAT

Инструкция для поднятия **приёмочной среды** перед production.

## Быстрый старт

```bash
# 1. Env (генерирует секреты Supabase + app)
npm run env:local

# 2. Запуск (Supabase + migrate + app :3001 + nginx :8080 + cron)
docker compose -f docker-compose.staging.yml up -d --build
# или: npm run compose:staging

# 3. Preflight
APP_URL=http://localhost:8080 CRON_SECRET=<secret> npm run uat:preflight

# 4. E2E smoke (опционально)
E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

| URL | Назначение |
|-----|------------|
| `http://localhost:8080` | ЕСЭДО через nginx (рекомендуется для UAT) |
| `http://localhost:3001` | App напрямую |
| `http://localhost:54321` | Supabase API (Kong) |

Порты: `STAGING_PORT` (app, по умолчанию 3001), `STAGING_NGINX_PORT` (nginx, по умолчанию 8080).

## Что входит в staging compose

| Сервис | Назначение |
|--------|------------|
| `db`, `kong`, `rest`, `storage`, `realtime`, `auth` | Self-hosted Supabase |
| `db-migrate` | SQL-миграции из `supabase/migrations/` |
| `app` | ЕСЭДО, `LOG_LEVEL=debug`, `SENTRY_ENVIRONMENT=staging` |
| `nginx` | Reverse proxy app + Supabase API |
| `cron` | Все internal hooks каждые 60 с (`CRON_INTERVAL_SEC`) |

Cron вызывает:

- `email-dispatch` (email + telegram outbox)
- `webhook-dispatch`
- `sla-tick`
- `retention-tick`
- `license-sync`
- `telegram-poll` — только если `ENABLE_TELEGRAM_POLL=1` (одна реплика)

Скрипт: `scripts/cron-runner.sh` (тот же для production profile `cron`).

## Подготовка данных UAT

1. Откройте `http://localhost:8080/auth` — зарегистрируйте первого пользователя (admin).
2. **Настройки → Общие** — укажите `app_url` (публичный URL staging).
3. Активируйте лицензию `FM1.*` или trial.
4. Создайте тестовых пользователей с ролями: registrar, approver, viewer.
5. Seed-данные применяются из `supabase/seed.sql` при первом `db-migrate` (`APPLY_DB_SEED=1`).

## Приёмочное тестирование

Полный чеклист: [UAT.md](./UAT.md).

Рекомендуемый порядок:

1. `npm run uat:preflight` — health + cron
2. `npm run uat:smoke` — health, migrations, DB
3. `npm run test:e2e` — автоматический smoke
4. Ручной проход UAT.md с заказчиком
5. Pen-test / security review ([SECURITY.md](./SECURITY.md))

## Остановка

```bash
npm run compose:staging:down
# или: docker compose -f docker-compose.staging.yml down
```

Данные Postgres и Storage сохраняются в `docker/supabase/volumes/`. Полный сброс:

```bash
docker compose -f docker-compose.staging.yml down -v
rm -rf docker/supabase/volumes/db/data docker/supabase/volumes/storage
```

## Production vs staging

| | Production | Staging |
|---|------------|---------|
| Compose | `docker-compose.yml` | `docker-compose.staging.yml` |
| HTTPS | `docker-compose.tls.yml` | HTTP nginx :8080 |
| Cron | `--profile cron` | всегда включён |
| Порт app | 3000 | 3001 |
| Порт nginx | 80 | 8080 |
| Seed | `APPLY_DB_SEED=0` | `APPLY_DB_SEED=1` |
| Логи | `info` | `debug` |

Production:

```bash
npm run env:production -- --domain=esedo.example.kz --install
docker compose -f docker-compose.tls.yml up -d --build
docker compose --profile cron up -d
```

Подробнее: [DEPLOYMENT.md](./DEPLOYMENT.md).

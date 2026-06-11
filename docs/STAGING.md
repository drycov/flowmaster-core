# Staging и UAT

Инструкция для поднятия **приёмочной среды** перед production.

## Быстрый старт

```bash
# 1. Env (генерирует секреты Supabase + app)
node scripts/docker-setup.mjs

# 2. Запуск (Supabase + миграции + app :3001 + cron)
docker compose -f docker-compose.staging.yml up -d --build

# 3. Preflight
APP_URL=http://localhost:3001 CRON_SECRET=<secret> sh scripts/uat-preflight.sh

# 4. E2E smoke (опционально)
E2E_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

Приложение: `http://localhost:3001` (порт меняется через `STAGING_PORT`).

Supabase API: `http://localhost:54321` (тот же Kong, что и в production compose).

## Что входит в staging compose

| Сервис | Назначение |
|--------|------------|
| `db`, `kong`, `rest`, `storage`, `realtime`, `auth` | Self-hosted Supabase |
| `db-migrate` | SQL-миграции из `supabase/migrations/` |
| `app` | ЕСЭДО, `LOG_LEVEL=debug`, `SENTRY_ENVIRONMENT=staging` |
| `cron` | Все internal hooks каждые 60 с (настраивается `CRON_INTERVAL_SEC`) |

Cron вызывает:

- `email-dispatch` (email + telegram outbox)
- `webhook-dispatch`
- `sla-tick`
- `retention-tick`
- `license-sync`
- `telegram-poll` — только если `ENABLE_TELEGRAM_POLL=1` (одна реплика)

Скрипт: `scripts/cron-runner.sh` (тот же для production profile `cron`).

## Подготовка данных UAT

1. Откройте `http://localhost:3001/auth` — зарегистрируйте первого пользователя (admin).
2. **Настройки → Общие** — укажите `app_url` (публичный URL staging).
3. Активируйте лицензию `FM1.*` или trial.
4. Создайте тестовых пользователей с ролями: registrar, approver, viewer.
5. Seed-данные применяются из `supabase/seed.sql` при первом `db-migrate` (`APPLY_DB_SEED=1`).

## Приёмочное тестирование

Полный чеклист: [UAT.md](./UAT.md).

Рекомендуемый порядок:

1. `uat-preflight.sh` — health + cron
2. `npm run test:e2e` — автоматический smoke
3. Ручной проход UAT.md с заказчиком
4. Pen-test / security review ([SECURITY.md](./SECURITY.md))

## Остановка

```bash
docker compose -f docker-compose.staging.yml down
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
| Supabase | self-hosted | self-hosted |
| Cron | `--profile cron` | всегда включён |
| Порт app | 3000 | 3001 (по умолчанию) |
| Логи | `info` | `debug` |

Production:

```bash
node scripts/docker-setup.mjs
docker compose up -d --build
docker compose --profile cron up -d
```

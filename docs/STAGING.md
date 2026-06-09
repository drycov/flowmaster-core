# Staging и UAT

Инструкция для поднятия **приёмочной среды** перед production.

## Быстрый старт

```bash
# 1. Env
cp .env.staging.example .env
# Заполните Supabase, CRON_SECRET, при необходимости E2E_* и Sentry

# 2. Миграции на staging Supabase
npx supabase link --project-ref <staging-ref>
npx supabase db push

# 3. Запуск (app :3001 + cron)
docker compose -f docker-compose.staging.yml up -d --build

# 4. Preflight
APP_URL=http://localhost:3001 CRON_SECRET=<secret> sh scripts/uat-preflight.sh

# 5. E2E smoke (опционально)
E2E_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

Приложение: `http://localhost:3001` (порт меняется через `STAGING_PORT`).

## Что входит в staging compose

| Сервис | Назначение |
|--------|------------|
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
5. Проверьте шаблон, маршрут, номенклатуру (миграции seed при `db reset`).

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

## Production vs staging

| | Production | Staging |
|---|------------|---------|
| Compose | `docker-compose.yml` | `docker-compose.staging.yml` |
| Cron | `--profile cron` | всегда включён |
| Порт | 3000 | 3001 (по умолчанию) |
| Логи | `info` | `debug` |

Production:

```bash
docker compose up -d --build
docker compose --profile cron up -d
```

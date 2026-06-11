# Docker

Self-hosted Supabase stack (vendored from [supabase/supabase/docker](https://github.com/supabase/supabase/tree/master/docker)) + Flowmaster app.

## Структура

```
docker/
  supabase/          # официальный Supabase Docker (PostgreSQL, Kong, PostgREST, Storage, Realtime)
  migrate/           # apply-migrations.sh — idempotent SQL migrations
```

Корневые compose-файлы:

- `docker-compose.yml` — production
- `docker-compose.staging.yml` — UAT (порт 3001, cron всегда включён)

## Быстрый старт

```bash
node scripts/docker-setup.mjs
docker compose up -d --build
```

## Профили

| Profile | Сервисы |
|---------|---------|
| (default) | db, kong, rest, storage, realtime, auth, db-migrate, app |
| `cron` | фоновые hooks (email, SLA, retention) |
| `studio` | Supabase Studio + meta + edge functions |

## Обновление Supabase stack

1. Сравните `docker/supabase/CHANGELOG.md` с upstream
2. Обновите `docker/supabase/docker-compose.yml` и `volumes/` при необходимости
3. `docker compose pull && docker compose up -d`

## Backup

```bash
docker exec supabase-db pg_dump -U postgres postgres > backup.sql
tar -czf storage-backup.tgz docker/supabase/volumes/storage
```

# Docker

Self-hosted Supabase stack (vendored from [supabase/supabase/docker](https://github.com/supabase/supabase/tree/master/docker)) + Flowmaster app.

## Compose-файлы

| Файл | Назначение |
|------|------------|
| `docker-compose.yml` | Production: Supabase + app + cron (profile) |
| `docker-compose.dev.yml` | Dev: только Supabase + migrate (app через `npm run dev`) |
| `docker-compose.staging.yml` | UAT на порту 3001 |

## Быстрый старт

```bash
node scripts/docker-setup.mjs
npm run docker:up              # полный стек
# или для разработки:
npm run docker:deps && npm run dev
```

## Скрипты

| Команда | Действие |
|---------|----------|
| `npm run docker:setup` | Создать `.env` с секретами |
| `npm run docker:up` | `up` → `db-migrate` → restart app → wait Kong |
| `npm run docker:deps` | Backend only (`docker-compose.dev.yml`) |
| `npm run docker:migrate` | Idempotent SQL migrations |
| `npm run docker:wait` | Ждать `http://localhost:54321` |

Флаги для `docker-up.mjs`: `--dev`, `--cron`, `--studio`.

## Переменные

- **На хосте** (`npm run dev`): `SUPABASE_URL=http://localhost:54321`
- **В контейнере app**: переопределяется на `http://kong:8000` в compose
- **Браузер**: `VITE_SUPABASE_URL=http://localhost:54321`

## Профили

| Profile | Сервисы |
|---------|---------|
| (default) | db, kong, rest, storage, realtime, auth, db-migrate, app |
| `cron` | фоновые hooks |
| `studio` | Supabase Studio + meta + edge functions |

## Backup

```bash
docker exec supabase-db pg_dump -U postgres postgres > backup.sql
tar -czf storage-backup.tgz docker/supabase/volumes/storage
```

## Сброс данных

```bash
docker compose down
rm -rf docker/supabase/volumes/db/data docker/supabase/volumes/storage
npm run docker:up
```

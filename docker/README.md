# Docker

Self-hosted Supabase stack (vendored from [supabase/supabase/docker](https://github.com/supabase/supabase/tree/master/docker)) + Flowmaster app + **nginx** reverse proxy.

## Compose-файлы

| Файл | Назначение |
|------|------------|
| `docker-compose.yml` | Production: Supabase + app + **nginx** + cron (profile) |
| `docker-compose.dev.yml` | Dev: только Supabase + migrate (app через `npm run dev`) |
| `docker-compose.staging.yml` | UAT: app :3001 + cron + **nginx** :8080 |
| `docker-compose.tls.yml` | Production HTTPS (Let's Encrypt) |
| `docker/compose/nginx-tls.overrides.yml` | TLS-патчи Supabase/nginx (include) |
| `docker/compose/supabase.overrides.yml` | Патчи Supabase (profiles, kong deps) |

## Архитектура (production)

```
Browser ──► nginx :80/:443 ──┬──► app:3000        (ЕСЭДО, /api/*)
                             └──► kong:8000       (/auth, /rest, /storage, …)
```

Единый публичный домен: `VITE_SUPABASE_URL` и `APP_URL` указывают на один URL (например `https://esedo.example.kz`). Конфиг nginx: `docker/nginx/conf.d/flowmaster.conf`.

## Быстрый старт

### Локальная разработка (Docker backend)

```bash
node scripts/docker-setup.mjs
npm run docker:deps && npm run dev
```

### Полный локальный стек

```bash
node scripts/docker-setup.mjs
npm run docker:up
# App + API: http://localhost (nginx) или :3000 / :54321 напрямую
```

### Production on-prem

```bash
npm run docker:setup:production -- --domain=esedo.example.kz --email=admin@example.kz --install
docker compose -f docker-compose.tls.yml up -d --build
docker compose --profile cron up -d
```

## Скрипты

| Команда | Действие |
|---------|----------|
| `npm run docker:setup` | Создать `.env` с секретами (localhost) |
| `npm run docker:setup:production` | Создать `.env.production` с доменом и prod-флагами |
| `npm run docker:up` | `up` → `db-migrate` → restart app → wait Kong |
| `npm run docker:deps` | Backend only (`docker-compose.dev.yml`) |
| `npm run docker:migrate` | Idempotent SQL migrations |
| `npm run docker:wait` | Ждать Supabase API |

Флаги для `docker-up.mjs`: `--dev`, `--cron`, `--studio`.

## Переменные окружения

| Контекст | `SUPABASE_URL` | `VITE_SUPABASE_URL` |
|----------|----------------|---------------------|
| `npm run dev` на хосте | `http://localhost:54321` | `http://localhost:54321` |
| Docker app (server) | `http://kong:8000` (override в compose) | из `.env` |
| Production через nginx | `https://your.domain` | `https://your.domain` |

Файлы:

| Файл | Назначение |
|------|------------|
| `.env.docker.example` | Шаблон локального Docker |
| `.env.production.example` | Шаблон production (домен, nginx, SMTP) |
| `.env.production` | Сгенерированный production env (gitignored) |
| `.env` | Активный env (gitignored) |

## Nginx

| Путь | Описание |
|------|----------|
| `docker/nginx/conf.d/flowmaster.conf` | HTTP reverse proxy (app + Supabase API) |
| `docker/nginx/flowmaster-nginx.conf.tpl` | HTTPS-шаблон для certbot override |

Переменные:

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `NGINX_HTTP_PORT` | `80` | Порт nginx на хосте |
| `NGINX_HTTPS_PORT` | `443` | HTTPS (с `docker-compose.tls.yml`) |
| `PROXY_DOMAIN` | — | Домен для Let's Encrypt |
| `CERTBOT_EMAIL` | — | Email для certbot |
| `STAGING_NGINX_PORT` | `8080` | Порт nginx в staging compose |

Healthcheck nginx: `GET /api/health` через proxy.

## Профили Compose

| Profile | Сервисы |
|---------|---------|
| (default) | db, kong, rest, storage, realtime, auth, db-migrate, app, **nginx** |
| `cron` | фоновые hooks (`scripts/cron-runner.sh`) |
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

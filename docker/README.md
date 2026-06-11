# Docker

Self-hosted Supabase + Flowmaster app + **nginx**. Compose entrypoints — в корне репозитория; патчи — в `docker/compose/`.

## Compose-файлы

| Файл | Project name | Назначение |
|------|--------------|------------|
| `docker-compose.yml` | `flowmaster` | HTTP production |
| `docker-compose.tls.yml` | `flowmaster` | HTTPS (Let's Encrypt) |
| `docker-compose.staging.yml` | `flowmaster-staging` | UAT (:8080 nginx, cron always on) |
| `docker-compose.license-server.yml` | `flowmaster-license-server` | Vendor license server |
| `docker-compose.dev.yml` | `flowmaster-dev` | Supabase + migrate (app на хосте) |
| `docker-compose.monitoring.yml` | — | Prometheus/Grafana (profile `monitoring`) |

Includes:

| Файл | Содержимое |
|------|------------|
| `docker/compose/flowmaster.services.yml` | app, nginx, db-migrate, cron |
| `docker/compose/supabase.overrides.yml` | Kong deps, studio profile |
| `docker/compose/staging.overrides.yml` | Staging ports, cron без profile |
| `docker/compose/nginx-tls.overrides.yml` | Certbot nginx, unpublish app/kong ports |
| `docker/supabase/docker-compose.yml` | Vendored Supabase base |

> **Не путать:** `docker/supabase/dev/docker-compose.dev.yml` — upstream Supabase overlay, **не** используется npm-скриптами. Dev backend: root `docker-compose.dev.yml` (`npm run docker:deps`).

## Архитектура

```
Browser ──► nginx :80/:443 ──┬──► app:3000        (ЕСЭДО, /api/*)
                             └──► kong:8000       (/auth/v1/, /rest, /storage, …)
```

## Быстрый старт

### Local

```bash
npm run env:local
npm run docker:up
curl http://localhost/api/health
```

Dev на хосте: `npm run docker:deps && npm run dev`

### Production HTTPS

```bash
npm run env:production -- --domain=esedo.example.kz --email=admin@example.kz --install
npm run compose:tls
npm run compose:tls:cron
curl https://esedo.example.kz/api/health
```

### Staging UAT

```bash
npm run env:staging -- --install
npm run env:sync
npm run compose:staging
curl http://localhost:8080/api/health
```

### `compose:*` vs `docker:*`

| Namespace | Когда использовать |
|-----------|-------------------|
| **`compose:*`** | Deploy-стеки: production TLS, staging, license server |
| **`docker:*`** | Локальная разработка, migrate, down, monitoring |

Дубликаты: `compose:full` = `docker:full`, `compose:tls:down` = `docker:down:tls`.

### License server (vendor)

```bash
npm run env:license-server -- --domain=license.example.kz --install
npm run compose:license-server
```

См. [docs/LICENSE-SERVER.md](../docs/LICENSE-SERVER.md).

## npm-скрипты

Полная таблица: [scripts/README.md](../scripts/README.md).

| Команда | Действие |
|---------|----------|
| `npm run env:local` / `env:production` / `env:staging` / `env:license-server` | Генерация env |
| `npm run env:sync` | `.env` → `docker/supabase/.env` |
| `npm run docker:up` | HTTP stack + migrate + wait |
| `npm run compose:tls` | HTTPS + ONLYOFFICE + migrate + wait |
| `npm run compose:tls:cron` | HTTPS + cron + ONLYOFFICE |
| `npm run compose:staging` | UAT stack + migrate + wait |
| `npm run docker:full` | cron + studio + monitoring |
| `npm run docker:up -- --office` | ONLYOFFICE для HTTP-стека |
| `npm run docker:migrate` | SQL-миграции (default HTTP stack) |
| `npm run docker:migrate -- --tls` / `--staging` | Миграции для другого stack |
| `npm run docker:down` / `docker:down:tls` / `docker:down:staging` | Остановка stack |

Флаги `docker-up.mjs`: `--dev`, `--tls`, `--cron`, `--studio`, `--monitoring`, `--office`, `--no-office`, `--full`.

## ONLYOFFICE

Document Server (~2 GB RAM, первый старт 2–3 мин).

**TLS:** `npm run compose:tls` / `compose:tls:cron` (профиль `office` по умолчанию).  
**HTTP:** `npm run docker:up -- --office`  
**Без ONLYOFFICE в TLS:** `node scripts/docker-up.mjs --tls --no-office`

```bash
npm run compose:tls
curl https://<domain>/onlyoffice/web-apps/apps/api/documents/api.js | head
```

- Nginx: `/onlyoffice/` → контейнер `onlyoffice:80`
- Порт `:8082` — прямой доступ (отладка)
- В админке: **Интеграции → ONLYOFFICE** → `http://localhost/onlyoffice` (или `https://domain/onlyoffice`)
- **Общие → app_url** = публичный URL ЕСЭДО

Конфиг: `docker/onlyoffice/local-production-linux.json` (доступ к private IP для Storage; не монтировать `local.json` — перезапишет БД/AMQP).  
Подробнее: [docs/INTEGRATIONS.md](../docs/INTEGRATIONS.md#onlyoffice).

## Переменные окружения

| Контекст | `SUPABASE_URL` (server) | `VITE_SUPABASE_URL` (browser) |
|----------|-------------------------|-------------------------------|
| `npm run dev` на хосте | `http://localhost:54321` | `http://localhost:54321` |
| Docker app | `http://kong:8000` (override) | из `.env` |
| Production nginx | `https://domain` | `https://domain` |

**Шаблон:** `.env.docker.example` (единственный).  
**Генерация:** `npm run env:*` — не редактируйте `.env.production.example` / `.env.staging.example` (legacy pointers).

## Compose profiles

| Profile | Сервисы |
|---------|---------|
| (default) | db, kong, rest, storage, app, nginx, db-migrate |
| `cron` | Sidecar `scripts/cron-runner.sh` |
| `office` | ONLYOFFICE Document Server |
| `studio` | Supabase Studio :54323 |
| `monitoring` | Prometheus, Grafana, exporters |

`npm run docker:full` = profiles `cron` + `studio` + `monitoring`.

## Nginx / TLS

| Путь | Описание |
|------|----------|
| `docker/nginx/conf.d/flowmaster.conf` | HTTP reverse proxy |
| `docker/nginx/flowmaster-nginx.conf.tpl` | HTTPS template (certbot) |

| Переменная | Default | Описание |
|------------|---------|----------|
| `NGINX_HTTP_PORT` | 80 | HTTP |
| `NGINX_HTTPS_PORT` | 443 | HTTPS |
| `STAGING_NGINX_PORT` | 8080 | Staging |
| `PROXY_DOMAIN` | — | Let's Encrypt |
| `SSL_SELF_SIGNED_FALLBACK` | 1 | Self-signed если LE недоступен |

## Мониторинг

```bash
npm run docker:monitoring
# или: npm run docker:up -- --monitoring
```

Grafana: `http://127.0.0.1:3001` — UI **Администрирование → Мониторинг**.

## Backup / reset

```bash
docker exec supabase-db pg_dump -U postgres postgres > backup.sql
docker compose down
rm -rf docker/supabase/volumes/db/data docker/supabase/volumes/storage
npm run docker:up
```

Подробнее: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

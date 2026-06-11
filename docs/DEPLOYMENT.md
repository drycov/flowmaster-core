# Развёртывание ЕСЭДО (Flowmaster Core)

## Архитектура

- **Single-tenant (по умолчанию):** одна организация на инсталляцию
- **Multi-tenant (SaaS-ready):** несколько изолированных организаций с общей БД, RLS по `organization_id`, вход по slug / поддомену
- **Приложение:** Node.js (TanStack Start + Nitro), порт `3000`
- **БД и API:** Self-hosted Supabase в Docker (PostgreSQL, PostgREST, Storage, Realtime)
- **Файлы:** Supabase Storage (локальный том `docker/supabase/volumes/storage`)

## Требования

| Компонент | Минимум |
|-----------|---------|
| Docker + Compose v2 | 24+ |
| Node.js | 22 LTS (только для сборки образа app) |
| RAM | 4 GB (Supabase stack + app) |
| CPU | 2 vCPU |
| Disk | 20 GB+ |

Для LDAP, Telegram polling, ONLYOFFICE — предпочтителен **Node runtime** (не edge-only Workers).

## 1. Docker-стек (рекомендуется)

```bash
npm ci --legacy-peer-deps
node scripts/docker-setup.mjs          # .env с JWT/ключами Postgres
docker compose up -d --build           # Supabase + миграции + app
docker compose --profile cron up -d    # outbox, SLA, retention
curl http://localhost:3000/api/health
```

| Сервис | URL / порт |
|--------|------------|
| ЕСЭДО | `http://localhost:3000` |
| Supabase API (Kong) | `http://localhost:54321` |
| Postgres (localhost) | `127.0.0.1:54322` |
| Studio (опционально) | `docker compose --profile studio up -d` |

Миграции из `supabase/migrations/` применяются сервисом `db-migrate` при первом запуске.
После добавления новых миграций:

```bash
npm run docker:migrate
docker compose up -d app
```

Шаблон переменных: `.env.docker.example`. Официальный Supabase Docker vendored в `docker/supabase/`.

### Облачный Supabase (альтернатива)

Если БД остаётся в Supabase Cloud — поднимайте только app:

```bash
cp .env.production.example .env
# SUPABASE_URL=https://your-project.supabase.co
docker compose up -d app cron   # без include db/kong (см. legacy compose ниже)
```

Для cloud-only используйте прежний workflow:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## 2. Переменные окружения

Скопируйте `.env.docker.example` → `.env` или выполните `node scripts/docker-setup.mjs`:

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `SUPABASE_URL` | да | Docker: `http://kong:8000` (server); cloud: URL проекта |
| `SUPABASE_PUBLISHABLE_KEY` | да | Anon/publishable key (= `ANON_KEY` в Docker) |
| `VITE_SUPABASE_*` | да | Браузер: `http://localhost:54321` + anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | да | Только на сервере |
| `SUPABASE_JWT_SECRET` | да | JWT secret из Supabase API settings |
| `CRON_SECRET` | prod | Секрет для internal hooks |
| `INSTALLATION_ID` | опц. | UUID инсталляции для лицензии |
| `LICENSE_SIGNING_SECRET` | опц. | Подпись FM1 ключей |
| `DISABLE_TELEGRAM_POLLING` | multi-replica | `true` при >1 реплике |
| `REPLICA_COUNT` | опц. | Число реплик app |
| `LOG_LEVEL` | опц. | `info` в production |
| `SENTRY_DSN` | опц. | Server-side error tracking |
| `VITE_SENTRY_DSN` | опц. | Client bundle (тот же DSN) |
| `SENTRY_ENVIRONMENT` | опц. | `production` / `staging` |
| `SENTRY_RELEASE` | опц. | Версия релиза (git tag / CI) |
| `SENTRY_TRACES_SAMPLE_RATE` | опц. | `0`–`1`, performance traces |
| `TENANT_BASE_DOMAIN` | multi-tenant | Базовый домен для поддоменов (`acme.example.kz` → slug `acme`) |
| `APP_BASE_DOMAIN` | multi-tenant | Алиас для `TENANT_BASE_DOMAIN` |

Почта, LDAP, Telegram, S3, ONLYOFFICE — **в админке** (хранятся в `organization.settings`).

**Публичный URL** приложения — **Настройки → Общие → app_url** (нужен для Telegram webhook, email links).

## 3. Подготовка БД (без Docker / cloud)

```bash
npx supabase start && npx supabase db push
# remote: npx supabase link --project-ref <ref> && npx supabase db push
```

## 4. Сборка и запуск

### Bare metal / VM

```bash
npm ci --legacy-peer-deps
npm run build
npm run start
```

`npm run start` слушает `0.0.0.0:3000`.

### Docker

```bash
node scripts/docker-setup.mjs
docker compose up -d --build
```

Опциональный cron sidecar (`scripts/cron-runner.sh`):

```bash
docker compose --profile cron up -d
```

Supabase Studio (админка БД):

```bash
docker compose --profile studio up -d
```

### Staging / UAT

```bash
cp .env.staging.example .env
docker compose -f docker-compose.staging.yml up -d --build
APP_URL=http://localhost:3001 CRON_SECRET=... npm run uat:preflight
```

Подробнее: [STAGING.md](./STAGING.md).

### Health check

```bash
curl http://localhost:3000/api/health
```

Ожидается `{"ok":true,"checks":{"app":"ok","database":"ok",...}}`.

## 5. Cron jobs (обязательно)

Все hooks: `Authorization: Bearer <CRON_SECRET>`.

| Endpoint | Интервал | Назначение |
|----------|----------|------------|
| `POST /api/public/hooks/email-dispatch` | 1–2 мин | Email + Telegram outbox |
| `POST /api/public/hooks/webhook-dispatch` | 1–2 мин | Webhook outbox |
| `POST /api/public/hooks/sla-tick` | 5–15 мин | SLA workflow |
| `POST /api/public/hooks/retention-tick` | 1×/сутки | Retention policies |
| `POST /api/public/hooks/license-sync` | каждые 6 ч | Phone-home license server (`LICENSE_SERVER_URL`) |
| `POST /api/public/hooks/telegram-poll` | опц. | Polling (только 1 реплика) |

Примеры: `scripts/cron-examples.sh`

### Linux crontab

```cron
*/2 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/email-dispatch
*/2 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/webhook-dispatch
*/10 * * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/sla-tick
15 3 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://esedo.example.kz/api/public/hooks/retention-tick
```

## 6. Reverse proxy (nginx)

### Single-tenant

```nginx
server {
  listen 443 ssl http2;
  server_name esedo.example.kz;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Multi-tenant (wildcard DNS)

1. DNS: `*.example.kz` → IP балансировщика / сервера
2. Env на app-серверах:

```env
TENANT_BASE_DOMAIN=example.kz
```

3. Nginx — wildcard + сохранение `Host` (приложение само определяет slug):

```nginx
server {
  listen 443 ssl http2;
  server_name example.kz *.example.kz;

  ssl_certificate     /etc/ssl/example.kz/fullchain.pem;
  ssl_certificate_key /etc/ssl/example.kz/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

4. **Provisioning:** Администрирование → Настройки → Организации → создать org (slug `acme`)
5. **Вход:** `https://acme.example.kz/auth` или `https://example.kz/auth` + поле «Код организации»
6. Отключённая org (`is_active = false`) не принимает новые входы

**Роли:** администраторы первой (primary) организации получают роль `platform_admin` (`manage_platform`) и могут создавать/редактировать org. Администраторы отдельных tenant-org управляют только своей организацией (роль `admin` без `manage_platform`). Роль `platform_admin` можно назначить вручную в **Пользователи** (колонка видна только platform admin).

**Квоты:** опциональный `max_users` на организацию (Настройки → Организации). Пустое значение = без org-лимита; глобальный лимит лицензии инсталляции по-прежнему применяется.

Без поддомена (только slug на общем домене) — достаточно `TENANT_BASE_DOMAIN`; пользователи вводят код org на экране входа.

## 7. Лицензия

### 6a. Offline (изолированный контур)

```bash
npm run license:generate -- --plan professional --customer "Организация"
```

Активация: **Администрирование → Настройки → Лицензия**. Проверка подписи `FM1` локально.

`LICENSE_MODE=offline` (по умолчанию) — интернет не требуется.

### 6b. Online (license server)

**На стороне поставщика** — отдельный инстанс с миграциями и:

```env
LICENSE_SERVER_ADMIN_SECRET=<random>
LICENSE_SIGNING_SECRET=<shared-with-keygen>
```

Регистрация ключа в реестре (опционально, auto-register при первой активации):

```bash
npm run license:server -- register --key "FM1...."
```

**На стороне заказчика:**

```env
LICENSE_MODE=online
LICENSE_SERVER_URL=https://license.vendor.kz
PUBLIC_APP_URL=https://esedo.example.kz
```

1. Админ активирует ключ в UI → `POST` на license server → выдаётся session token.
2. Cron phone-home каждые 6 ч:

```bash
curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/public/hooks/license-sync"
```

3. Отзыв с стороны поставщика:

```bash
npm run license:server -- revoke --installation-id <INSTALLATION_ID> --reason "Contract ended"
```

Без синхронизации дольше 72 ч (`offline_grace_hours`) — запись данных блокируется.

## 8. Backup

| Объект | Метод |
|--------|-------|
| PostgreSQL | Supabase Dashboard → Backups / `pg_dump` |
| Storage | Supabase Storage export / S3 replication |
| Настройки org | Включены в DB (`organization.settings`) |
| `.env` | Secrets manager (не в git) |

Рекомендуется: ежедневный snapshot БД + weekly storage.

## 9. Обновление версии

```bash
git pull
npx supabase db push    # новые миграции
npm ci --legacy-peer-deps
npm run build
# restart app / docker compose up -d --build
```

Проверьте `/api/health` и smoke: login → документ → задача.

## 10. CI/CD

GitHub Actions: `.github/workflows/ci.yml` — lint, test, build.

Деплой — по вашему pipeline (SSH, K8s, Docker registry).

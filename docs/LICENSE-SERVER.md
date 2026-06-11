# Сервер лицензирования (vendor)

Отдельный деплой FlowMaster с `LICENSE_SERVER_ENABLED=true`. Клиентские инсталляции обращаются к нему по `LICENSE_SERVER_URL` (режим `online` / `hybrid`).

## Быстрый старт

```bash
# 1. Сгенерировать .env (секреты LICENSE_SIGNING_SECRET + LICENSE_SERVER_ADMIN_SECRET)
npm run env:license-server -- --domain=license.satory.kz --email=admin@satory.kz --install

# 2. Запустить стек
npm run compose:license-server

# 3. Проверить
curl -k https://license.satory.kz/api/v1/license/health
curl -k https://license.satory.kz/api/health
```

## Роли

| Роль | Переменные | API |
|------|------------|-----|
| **License server** | `LICENSE_SERVER_ENABLED=true`, `LICENSE_SERVER_ADMIN_SECRET` | `/api/v1/license/*` |
| **Клиент (on-prem)** | `LICENSE_MODE=online`, `LICENSE_SERVER_URL`, тот же `LICENSE_SIGNING_SECRET` | `/hooks/license-sync` (cron) |

На клиентских установках маршруты `/api/v1/license/*` **отключены** (404), если `LICENSE_SERVER_ENABLED` не задан.

## Выдача ключей

```bash
# На машине vendor (использует LICENSE_SIGNING_SECRET из .env)
npm run license:generate -- --plan professional --customer "Организация"

# Зарегистрировать ключ на server (опционально, до активации клиентом)
LICENSE_SERVER_URL=https://license.satory.kz npm run license:server -- register --key "FM1...."

# Отозвать активацию
LICENSE_SERVER_URL=https://license.satory.kz npm run license:server -- revoke --installation-id <uuid>
```

## Подключение клиента

```bash
# На сервере клиента — тот же LICENSE_SIGNING_SECRET, что на license server:
npm run env:production -- \
  --domain=edms.client.kz \
  --license-secret=<LICENSE_SIGNING_SECRET из .env license server> \
  --license-server-url=https://license.satory.kz \
  --install
```

В `.env` клиента будет `LICENSE_MODE=online` и `LICENSE_SERVER_URL`.

Активация: **Администрирование → Настройки → Лицензия** (ввод FM1-ключа).

Cron на клиенте (`license-sync`):

```bash
docker compose -f docker-compose.tls.yml --profile cron up -d
```

## API

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/api/v1/license/health` | — | Health license server |
| POST | `/api/v1/license/activate` | — | Активация установки (FM1 + installation_id) |
| POST | `/api/v1/license/heartbeat` | Token | Phone-home |
| POST | `/api/v1/license/register-key` | Bearer admin | Pre-register ключа |
| POST | `/api/v1/license/revoke` | Bearer admin | Отзыв |

## Секреты

- **`LICENSE_SIGNING_SECRET`** — общий HMAC-секрет для FM1-ключей (vendor + все клиенты).
- **`LICENSE_SERVER_ADMIN_SECRET`** — только на license server; для CLI `license:server` и admin API.

Не используйте `SUPABASE_JWT_SECRET` как signing secret в production — задайте отдельный `LICENSE_SIGNING_SECRET`.

## npm-команды

| Команда | Описание |
|---------|----------|
| `npm run env:license-server` | Генерация `.env.license-server` |
| `npm run compose:license-server` | Docker TLS stack |
| `npm run license:generate` | Создать FM1-ключ |
| `npm run license:server` | Admin CLI (register/revoke) |

См. также: [DEPLOYMENT.md](./DEPLOYMENT.md), [SECURITY.md](./SECURITY.md).

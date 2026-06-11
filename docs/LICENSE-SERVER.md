# Сервер лицензирования (vendor)

Отдельный деплой license server. Клиентские инсталляции обращаются к нему по `LICENSE_SERVER_URL`.

**Варианты деплоя:**

| Вариант | Когда использовать |
|---------|-------------------|
| **[Vercel — `apps/cloud-license-server`](../apps/cloud-license-server/README.md)** | Облако без своего Docker, serverless |
| **Docker — `compose:license-server`** | Self-hosted на своём VPS |

**Админка vendor не входит в EDMS**. Для Docker: локально через support code и SSH tunnel. Для **Vercel**: `/admin` на том же домене (support code + httpOnly cookie). Bearer API — для автomation.

## Быстрый старт (Vercel)

Публикуется как **единый проект**: landing + кабинет клиента + license API.

```bash
# 1. Supabase: миграции 001 + 002, Auth Email включён
# 2. Vercel Root Directory = apps/cloud-license-server
# 3. Env: SUPABASE_*, LICENSE_SERVER_ADMIN_SECRET, VITE_SUPABASE_*, VITE_LICENSE_SERVER_URL
# 4. Deploy → LICENSE_SERVER_URL=https://xxx.vercel.app на клиентах
```

- `/` — landing с тарифами  
- `/register`, `/cabinet` — личный кабинет (пробная лицензия + installation_id)  
- `/api/v1/license/*` — API для EDMS  

Подробнее: [apps/cloud-license-server/README.md](../apps/cloud-license-server/README.md)

## Быстрый старт (Docker / self-hosted)

```bash
# 1. Сгенерировать .env (секреты LICENSE_SIGNING_SECRET + LICENSE_SERVER_ADMIN_SECRET)
npm run env:license-server -- --domain=license.satory.kz --email=admin@satory.kz --install

# 2. Запустить стек (migrate + wait включены)
npm run compose:license-server

# 3. Проверить
curl -k https://license.satory.kz/api/v1/license/health
```

## Локальная админка (support code + SSH)

На **хосте license server** (по SSH), в каталоге с `.env`:

```bash
# Терминал 1 — UI только на 127.0.0.1:3847
npm run license:admin

# Терминал 2 — одноразовый код (15 мин)
npm run license:support-code
# → 12345678
```

С **ноутбука**:

```bash
ssh -L 3847:127.0.0.1:3847 user@license-server
```

Браузер: `http://127.0.0.1:3847/vendor/license` → ввести support code.

Переменные (только при `npm run license:admin`, **не** в docker compose):

| Переменная | Описание |
|------------|----------|
| `LICENSE_SERVER_LOCAL_ADMIN=true` | Включает `/vendor/license/*` |
| `LICENSE_SERVER_ENABLED=true` | Доступ к таблицам license server |
| `LICENSE_SERVER_ADMIN_SECRET` | Подпись support code и сессии |

На публичном деплое (`compose:license-server`) `LICENSE_SERVER_LOCAL_ADMIN` **не задаётся** — маршруты `/vendor/*` отдают 404.

## Роли

| Роль | Переменные | API |
|------|------------|-----|
| **License server** | `LICENSE_SERVER_ENABLED=true`, `LICENSE_SERVER_ADMIN_SECRET` | `/api/v1/license/*` |
| **Клиент (on-prem)** | `LICENSE_MODE=online`, `LICENSE_SERVER_URL`, тот же `LICENSE_SIGNING_SECRET` | `/hooks/license-sync` (cron) |

На клиентских установках маршруты `/api/v1/license/*` **отключены** (404), если `LICENSE_SERVER_ENABLED` не задан.

## Выдача ключей

```bash
# FM1-ключ (на машине vendor)
npm run license:generate -- --plan professional --customer "Организация"

# CLI register/revoke (Bearer LICENSE_SERVER_ADMIN_SECRET)
npm run license:server -- register --key "FM1...."
npm run license:server -- revoke --installation-id <uuid>
```

Или через локальную админку после входа по support code.

## Подключение клиента (облачная схема)

Клиент **не вводит FM1-ключ**. Достаточно `LICENSE_SERVER_URL` и `INSTALLATION_ID` — EDMS при старте автоматически вызывает `POST /api/v1/license/connect`.

```bash
npm run env:production -- \
  --domain=edms.client.kz \
  --license-secret=<LICENSE_SIGNING_SECRET из .env license server> \
  --license-server-url=https://license.satory.kz \
  --install
```

На vendor: зарегистрируйте `installation_id` клиента в локальной админке (**Установки → Зарегистрировать установку**) или CLI. FM1-ключ нужен только для legacy/offline сценариев.

Статус на клиенте: **Администрирование → Настройки → Лицензия** (только просмотр и «Синхронизировать»).

При потере связи с облаком EDMS переходит в **offline mode** — лицензия остаётся активной по последней синхронизации (кроме явного отзыва или истечения срока).

## API

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/api/v1/license/health` | — | Health license server |
| POST | `/api/v1/license/connect` | — | Автоподключение по `installation_id` (без FM1) |
| POST | `/api/v1/license/activate` | — | Активация по FM1-ключу (legacy) |
| POST | `/api/v1/license/heartbeat` | Token | Phone-home |
| POST | `/api/v1/license/provision` | Bearer admin | Регистрация installation_id (cloud) |
| POST | `/api/v1/license/generate-key` | Bearer admin | FM1 + provision (legacy) |
| POST | `/api/v1/license/register-key` | Bearer admin | Pre-register FM1 |
| POST | `/api/v1/license/revoke` | Bearer admin | Отзыв |

## npm-команды

| Команда | Описание |
|---------|----------|
| `npm run env:license-server` | Генерация `.env.license-server` |
| `npm run compose:license-server` | Docker TLS stack (без web admin) |
| `npm run license:generate` | Создать FM1-ключ |
| `npm run license:server` | Admin CLI (register/revoke) |
| `npm run license:support-code` | Support code для локальной админки |
| `npm run license:admin` | Локальный UI на 127.0.0.1 |

См. также: [DEPLOYMENT.md](./DEPLOYMENT.md), [SECURITY.md](./SECURITY.md).

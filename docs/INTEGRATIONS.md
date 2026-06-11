# Интеграции ЕСЭДО

## Multi-tenant

API keys, webhooks и import jobs привязаны к **организации** (`organization_id`). Ключ видит только документы и задачи своей org; webhook-подписки получают события только из той же org. Настройки LDAP, SMTP, Telegram — в `organization.settings` каждого tenant.

Подробнее: [MULTI-TENANT.md](./MULTI-TENANT.md).

---

## REST API v1

**Base URL:** `https://<your-domain>/api/v1` (тот же домен, что и веб-приложение; nginx проксирует `/api` на app)

**Аутентификация:**

```http
Authorization: Bearer fm_<api_key>
# или
X-Api-Key: fm_<api_key>
```

**OpenAPI:** [api-v1.yaml](./api-v1.yaml)

### Scopes

| Scope | Доступ |
|-------|--------|
| `documents:read` | Чтение документов |
| `documents:write` | Создание, PATCH, версии, статус |
| `tasks:read` | Список задач владельца ключа |
| `tasks:write` | Завершение задач (approve/reject/return) |
| `contracts:read` | Реестр контрактов |
| `import:write` | Batch import входящих |

### Endpoints

```
GET    /api/v1/documents
POST   /api/v1/documents
GET    /api/v1/documents/:id
PATCH  /api/v1/documents/:id
PATCH  /api/v1/documents/:id/status
POST   /api/v1/documents/:id/versions
GET    /api/v1/tasks
POST   /api/v1/tasks/:id/complete
GET    /api/v1/contracts
POST   /api/v1/import/incoming
```

### Примеры

**Список документов:**

```bash
curl -H "Authorization: Bearer fm_xxx" \
  "https://esedo.example.kz/api/v1/documents?status=draft&limit=20"
```

**Создание документа:**

```bash
curl -X POST -H "Authorization: Bearer fm_xxx" \
  -H "Content-Type: application/json" \
  -d '{"title_ru":"Входящий документ","document_type_code":"incoming"}' \
  https://esedo.example.kz/api/v1/documents
```

**Завершение задачи:**

```bash
curl -X POST -H "Authorization: Bearer fm_xxx" \
  -H "Content-Type: application/json" \
  -d '{"decision":"approve"}' \
  https://esedo.example.kz/api/v1/tasks/<task-id>/complete
```

**Версия документа (текст):**

```bash
curl -X POST -H "Authorization: Bearer fm_xxx" \
  -H "Content-Type: application/json" \
  -d '{"body":"Новый текст","comment":"API update"}' \
  https://esedo.example.kz/api/v1/documents/<doc-id>/versions
```

### Content masking

При недостаточном грифе API возвращает документ с `content_restricted: true`, `body: null`.

---

## Webhooks (исходящие)

Настройка: **Администрирование → Настройки → Интеграции**

### Активные события (DB triggers)

| Event | Когда |
|-------|-------|
| `task.created` | Новая задача workflow |
| `document.signed` | Подпись документа |
| `document.status_changed` | Смена статуса документа |

### Payload

```json
{
  "event": "document.status_changed",
  "payload": { "document_id": "...", "status": "approved" },
  "timestamp": "2026-06-09T12:00:00.000Z"
}
```

### Подпись

```
X-Flowmaster-Signature: HMAC-SHA256(secret, body)
X-Flowmaster-Event: document.status_changed
```

Проверяйте подпись на стороне получателя. Тест доставки — кнопка **Тест** в админке.

### Dispatch cron

```
POST /api/public/hooks/webhook-dispatch
Authorization: Bearer <CRON_SECRET>
```

---

## LDAP / Active Directory

**Настройки → LDAP:**

- URL, Base DN, bind user/password
- Filter template, TLS
- Auto-provision, default role, email domain policy

Тест подключения — кнопка в настройках.

---

## Telegram

**Настройки → Telegram:**

1. Создайте бота у [@BotFather](https://t.me/BotFather) и скопируйте токен
2. **Общие → app_url** (публичный HTTPS)
3. Зарегистрируйте webhook (генерирует secret и обновляет описание/команды бота)
4. Пользователи привязывают бота в профиле

### Профиль бота (BotFather)

При регистрации webhook приложение автоматически выставляет **описание**, **About** и **команды** через Bot API (`setMyDescription`, `setMyShortDescription`, `setMyCommands`).

Если нужно настроить вручную в BotFather → **Edit Bot**:

| Поле | Текст |
|------|-------|
| **Description** | Официальный бот **ЕСЭДО** — системы электронного документооборота. Уведомления о задачах и согласованиях, заявки на отпуск, дежурства. Привязка: ЕСЭДО → Профиль → Telegram → «Подключить». |
| **About** | Уведомления и быстрый доступ к задачам ЕСЭДО: согласования, отпуска, дежурства. |
| **Commands** | `start` — главное меню или привязка; `newpassword` — новый пароль после сброса |

Функции:
- Уведомления (tasks, approvals)
- Login (опционально)
- Password reset (опционально)

При нескольких репликах app: `DISABLE_TELEGRAM_POLLING=true`, только webhook.

---

## Email

**Настройки → Почта:**

- SMTP или Resend API
- Тест отправки

Outbox обрабатывается cron `email-dispatch` (каждые 1–2 мин).

---

## ONLYOFFICE

Встроенный редактор DOCX/XLSX на вкладке **Office Web** документа. Сохранение — через callback в новую версию файла.

### Docker (рекомендуется)

```bash
npm run env:local   # или env:production — в .env уже ONLYOFFICE_* для Docker-сети
npm run docker:up -- --office
# первый запуск Document Server: 2–3 мин (healthcheck)
curl -sf http://localhost:8082/healthcheck
curl -sf http://localhost/onlyoffice/web-apps/apps/api/documents/api.js | head
```

| Компонент | URL |
|-----------|-----|
| Через nginx | `http://localhost/onlyoffice` |
| Напрямую | `http://localhost:8082` |
| Callback app | `{app_url}/api/public/hooks/office-callback` |

Профиль Compose: `office`. RAM: **+2 GB** к минимуму.

Переменные в `.env` (см. `.env.docker.example`):

| Переменная | Назначение |
|------------|------------|
| `ONLYOFFICE_CALLBACK_BASE_URL` | Внутренний URL для Document Server → app (`http://nginx` в Docker) |
| `ONLYOFFICE_STORAGE_INTERNAL_URL` | Kong для signed URL файлов (`http://kong:8000`) |
| `ONLYOFFICE_JWT_ENABLED` | `false`; если `true` — задайте одинаковый `ONLYOFFICE_JWT_SECRET` у Document Server **и** у app |
| `ONLYOFFICE_JWT_SECRET` | Секрет HS256 для подписи конфига редактора (app → ONLYOFFICE) |

### Настройка в админке

**Администрирование → Настройки → Интеграции:**

1. Включить **ONLYOFFICE**
2. **Document Server URL** — публичный адрес **без** завершающего `/`:
   - local: `http://localhost/onlyoffice`
   - production TLS: `https://esedo.example.kz/onlyoffice`
3. **Настройки → Общие → app_url** — публичный URL ЕСЭДО (тот же origin, что у пользователей)

### Требования к документу

- Статус `draft` или `returned_for_revision` — редактирование; иначе только просмотр
- На текущей версии должен быть файл **DOCX/XLSX** (вкладка «Версии»)

### Production HTTPS

Nginx TLS (`docker-compose.tls.yml`) проксирует `/onlyoffice/` автоматически. В интеграциях укажите `https://<domain>/onlyoffice`.

### Bare metal / внешний Document Server

Если ONLYOFFICE не в этом Compose — укажите URL внешнего сервера. Document Server должен достучаться до:

- signed URL Supabase Storage (`/storage/v1/...`)
- callback `{app_url}/api/public/hooks/office-callback`

Подробнее: [docker/README.md](../docker/README.md#onlyoffice).

---

## S3 (опционально)

External S3-compatible storage для интеграций — в настройках integrations.

Файлы пользователей по умолчанию в Supabase Storage.

---

## Import API

```bash
curl -X POST -H "Authorization: Bearer fm_xxx" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"title_ru":"Письмо 1","external_reg_number":"IN-001"}]}' \
  https://esedo.example.kz/api/v1/import/incoming
```

Max 500 items per request. Job history в админке → Интеграции.

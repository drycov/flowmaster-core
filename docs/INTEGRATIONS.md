# Интеграции ЕСЭДО

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

1. Bot token от @BotFather
2. **Общие → app_url** (публичный HTTPS)
3. Зарегистрировать webhook (генерирует secret)
4. Пользователи привязывают бота в профиле

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

**Настройки → Интеграции → Office:**

- Document server URL
- Callback: `/api/public/hooks/office-callback`

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

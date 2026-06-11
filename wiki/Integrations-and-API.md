# Интеграции и API

**Полная версия:** [`docs/INTEGRATIONS.md`](../docs/INTEGRATIONS.md)

## REST API v1

```
Base: https://<domain>/api/v1
Auth: Authorization: Bearer fm_<key>
      или X-Api-Key: fm_<key>
```

**OpenAPI:** `docs/api-v1.yaml`

### Scopes

`documents:read/write` · `tasks:read/write` · `contracts:read` · `import:write`

## Webhooks

Исходящие события, HMAC подпись. Управление в **Администрирование → Интеграции**.

## LDAP / Telegram / Email

Настройки в UI (`organization.settings`). Cron `email-dispatch`.

## ONLYOFFICE

- Compose profile `office`, +2 GB RAM
- Production: `ONLYOFFICE_JWT_ENABLED=true`
- URL в админке: `https://domain/onlyoffice`

```bash
npm run compose:tls    # TLS + office
npm run docker:up -- --office   # HTTP local
```

## Batch import

`POST /api/v1/import/incoming` — до 500 items.

→ [Docker](Docker)

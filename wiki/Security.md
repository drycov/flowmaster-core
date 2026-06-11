# Безопасность

**Полная версия:** [`docs/SECURITY.md`](../docs/SECURITY.md)

## Auth

- Email/password, LDAP, ЭЦП (NCALayer), Telegram
- Access JWT + HttpOnly refresh cookie `fm_refresh`
- Сессии в `app_sessions`

## RBAC и грифы

- Роли: admin, registrar, approver, signer, archivist, viewer
- 19 permissions через `user_has_permission()`
- Грифы: `can_view_document()`, `can_view_document_content()`

## RLS

PostgreSQL RLS с `tenant_matches(organization_id)` на tenant-таблицах.

## Интеграции

| Механизм | Защита |
|----------|--------|
| API keys | `fm_*`, SHA-256, scopes |
| Webhooks | HMAC `X-Flowmaster-Signature` |
| Cron | `CRON_SECRET` (обязателен) |
| ONLYOFFICE | JWT callback |
| Telegram | `X-Telegram-Bot-Api-Secret-Token` |

## Hardening (prod)

- `CRON_SECRET`, `ONLYOFFICE_JWT_ENABLED=true`
- HTTPS + HSTS, `APPLY_DB_SEED=0`
- `ENABLE_EMAIL_AUTOCONFIRM=false`
- Sentry DSN

## Инцидент

1. Отозвать API keys
2. Ротировать `CRON_SECRET`, `JWT_SECRET`
3. Очистить `app_sessions`
4. `audit_logs`

→ [Operations Runbook](Operations-Runbook) · `docs/RUNBOOK.md#security-incident`

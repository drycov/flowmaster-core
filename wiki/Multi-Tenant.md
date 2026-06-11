# Multi-tenant

**Полная версия:** [`docs/MULTI-TENANT.md`](../docs/MULTI-TENANT.md)

## Модель

Несколько **organization** на одной БД и одном app. Изоляция:

1. `organization_id` + RLS
2. JWT `org_id`
3. Server Functions (`tenant-*.server.ts`)

## Вход

- Поддомен: `acme.example.kz` → slug `acme`
- Или общий домен + поле «Код организации»

## Env

```env
TENANT_BASE_DOMAIN=example.kz
```

## DNS + nginx

Wildcard `*.example.kz` → сервер, сохранять `Host`.

## Provisioning

**Администрирование → Организации** → создать org (slug).

## Роли

- Primary org → `manage_platform`
- Tenant admin — только своя org

## Миграции (ключевые)

- `20260612030000_tenant_foundation.sql`
- `20260614000000_phase3_tenant_rls_complete.sql`

→ [Architecture](Architecture) · [Security](Security)

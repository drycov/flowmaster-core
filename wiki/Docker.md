# Docker

**Полная версия:** [`docker/README.md`](../docker/README.md)

## Compose

| Файл | Stack |
|------|-------|
| `docker-compose.yml` | HTTP local |
| `docker-compose.tls.yml` | HTTPS prod |
| `docker-compose.staging.yml` | UAT :8080 |
| `docker-compose.license-server.yml` | Vendor LS |
| `docker-compose.dev.yml` | Supabase only (host dev) |

## Команды

| Задача | Команда |
|--------|---------|
| Local up | `npm run docker:up` |
| Prod TLS | `npm run compose:tls:cron` |
| Staging | `npm run compose:staging` |
| Migrate | `npm run docker:migrate [--tls|--staging]` |
| Down | `npm run docker:down:tls` |

## Profiles

`cron` · `office` (ONLYOFFICE) · `studio` · `monitoring`

## `compose:*` vs `docker:*`

- **compose:*** — deploy (TLS, staging, license server)
- **docker:*** — dev, migrate, утилиты

Справочник: `scripts/README.md`

## ONLYOFFICE

+2 GB RAM, nginx `/onlyoffice/`, порт :8082 отладка.

→ [Integrations and API](Integrations-and-API)

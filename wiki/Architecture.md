# Архитектура

**Полная версия:** [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

## Runtime

| Слой | Технология |
|------|------------|
| UI/SSR | React 19, TanStack Start |
| Server | Nitro, Server Functions |
| БД | PostgreSQL (self-hosted Supabase) |
| Proxy | nginx (единый origin) |
| Файлы | Supabase Storage |

## HTTP

| Путь | Backend |
|------|---------|
| `/`, `/documents`, UI | `app:3000` |
| `/api/v1/*`, hooks | `app:3000` |
| `/auth`, `/rest`, `/storage` | `kong:8000` |
| `/onlyoffice/*` | profile `office` |

**Важно:** в Docker `app` использует `SUPABASE_URL=http://kong:8000`; браузер — публичный URL через nginx.

## Compose-стеки

| Файл | Назначение |
|------|------------|
| `docker-compose.yml` | HTTP local |
| `docker-compose.tls.yml` | HTTPS prod |
| `docker-compose.staging.yml` | UAT :8080 |
| `docker-compose.license-server.yml` | Vendor LS |

→ [Docker](Docker)

## Лицензирование

| Режим | Описание |
|-------|----------|
| Offline FM1 | Ключ в UI |
| Online Vercel | EDMS → cloud LS |
| Docker vendor | Self-hosted LS |
| Replica | Local LS → Vercel |

→ [Licensing](Licensing)

## Multi-tenant

RLS по `organization_id`, slug из `Host`.

→ [Multi-Tenant](Multi-Tenant)

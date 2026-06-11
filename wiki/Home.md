# ЕСЭДО (Flowmaster Core)

**Единая система электронного документооборота** для организаций Казахстана.

| | |
|---|---|
| **Репозиторий** | `flowmaster-core` |
| **Стек** | React 19, TanStack Start, PostgreSQL (Supabase), nginx, Docker |
| **Лицензия ПО** | Проприетарная (FM1 / online) |
| **Облачный LS** | `apps/cloud-license-server` (Vercel) |

## Возможности

- Документы, workflow, ЭЦП (NCALayer), архив, грифы
- RBAC, LDAP, Telegram, REST API v1
- ONLYOFFICE, база знаний, контракты
- **Multi-tenant** (SaaS-ready)
- Online / offline лицензирование

## Архитектура (кратко)

```
Browser → nginx → app:3000 (UI, /api)
              └──→ kong:8000 (Auth, REST, Storage)
```

Подробнее: [Architecture](Architecture) · Полный текст: `docs/ARCHITECTURE.md`

## С чего начать

| Роль | Wiki | Полный guide |
|------|------|--------------|
| Разработчик | [Quick Start](Quick-Start) → [Development](Development) | `docs/QUICKSTART.md` |
| DevOps | [Deployment](Deployment) → [Runbook](Operations-Runbook) | `docs/DEPLOYMENT.md` |
| Вендор | [Licensing](Licensing) → [Cloud LS](Cloud-License-Server) | `docs/LICENSE-SERVER.md` |
| Интегратор | [Integrations and API](Integrations-and-API) | `docs/INTEGRATIONS.md` |
| Приёмка | [Staging and UAT](Staging-and-UAT) | `docs/UAT.md` |

## Быстрые команды

```bash
npm ci --legacy-peer-deps
npm run env:local && npm run docker:up    # local
curl http://localhost/api/health

npm run env:production -- --domain=esedo.example.kz --email=admin@example.kz --install
npm run compose:tls:cron                  # production
```

Скрипты: `scripts/README.md` в репозитории.

## Карта wiki

| Раздел | Страницы |
|--------|----------|
| Старт | Quick Start, Development, Glossary |
| Архитектура | Architecture, Environment Variables, Multi-Tenant |
| Ops | Deployment, Runbook, Docker, CI/CD, Troubleshooting |
| Продукт | Security, Integrations, Licensing, Cloud LS, Staging/UAT |

## Документация в репозитории

Полный комплект (17+ файлов): **`docs/README.md`**

- `CHANGELOG.md` — релизы
- `e2e/README.md` — Playwright
- `docker/README.md` — Compose

## Структура репо

```
src/              ЕСЭДО
supabase/         миграции БД
docker/           Compose, nginx
apps/cloud-license-server/
docs/             канонические guides
wiki/             эта wiki
```

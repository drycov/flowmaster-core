# Документация ЕСЭДО (Flowmaster Core)

Единая точка входа в документацию монорепозитория.

**Wiki (навигация):** [wiki/Home.md](../wiki/Home.md) · [wiki/README.md](../wiki/README.md) (публикация в GitHub Wiki)

**Продукт:** ЕСЭДО — EDMS для Казахстана (on-prem / SaaS).  
**Сателлит:** `apps/cloud-license-server` — облачный сервер лицензирования (Vercel).

---

## С чего начать

| Кто вы | Старт |
|--------|-------|
| Новый разработчик | **[QUICKSTART.md](./QUICKSTART.md)** → [CONTRIBUTING.md](./CONTRIBUTING.md) |
| DevOps / администратор | [QUICKSTART.md](./QUICKSTART.md) → [DEPLOYMENT.md](./DEPLOYMENT.md) → [RUNBOOK.md](./RUNBOOK.md) |
| Вендор (лицензии) | [LICENSE-SERVER.md](./LICENSE-SERVER.md) → [apps/cloud-license-server/README.md](../apps/cloud-license-server/README.md) |
| Интегратор (API) | [INTEGRATIONS.md](./INTEGRATIONS.md) → [api-v1.yaml](./api-v1.yaml) |
| Приёмка / пилот | [STAGING.md](./STAGING.md) → [UAT.md](./UAT.md) |
| Не знаете термин | [GLOSSARY.md](./GLOSSARY.md) |

---

## Полный комплект (`docs/`)

| Документ | Назначение |
|----------|------------|
| [README.md](./README.md) | Этот индекс |
| [QUICKSTART.md](./QUICKSTART.md) | Clone → docker:up → первый вход (5 мин) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Компоненты, HTTP-потоки, лицензии, миграции |
| [GLOSSARY.md](./GLOSSARY.md) | Термины и сокращения |
| [ENV.md](./ENV.md) | Переменные окружения |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production: TLS, nginx, cron, обновление |
| [RUNBOOK.md](./RUNBOOK.md) | Дежурство: backup, restore, инциденты |
| [CI.md](./CI.md) | GitHub Actions, deploy, smoke |
| [SECURITY.md](./SECURITY.md) | Auth, RLS, hardening |
| [MULTI-TENANT.md](./MULTI-TENANT.md) | SaaS: tenant, RLS, DNS |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | API v1, LDAP, Telegram, ONLYOFFICE |
| [LICENSE-SERVER.md](./LICENSE-SERVER.md) | Vercel / Docker vendor / replica |
| [STAGING.md](./STAGING.md) | UAT-стек |
| [UAT.md](./UAT.md) | Чеклист приёмки |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Lint, test, миграции |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Быстрые фиксы |
| [api-v1.yaml](./api-v1.yaml) | OpenAPI `/api/v1` |

Корень репозитория: [CHANGELOG.md](../CHANGELOG.md) — история релизов.

---

## Wiki

| Путь | Назначение |
|------|------------|
| [../wiki/Home.md](../wiki/Home.md) | Главная wiki, навигация по ролям |
| [../wiki/_Sidebar.md](../wiki/_Sidebar.md) | Боковое меню (GitHub Wiki) |
| [../wiki/README.md](../wiki/README.md) | Публикация wiki на GitHub |

Wiki — краткие страницы; канонический текст остаётся в `docs/`.

## Документация вне `docs/`

| Путь | Назначение |
|------|------------|
| [../README.md](../README.md) | Обзор продукта, быстрый старт, стек |
| [../docker/README.md](../docker/README.md) | Docker Compose, профили, ONLYOFFICE |
| [../scripts/README.md](../scripts/README.md) | Канонический справочник npm-скриптов |
| [../apps/cloud-license-server/README.md](../apps/cloud-license-server/README.md) | Vercel, кабинет, Cloud Admin |
| [../src/routes/README.md](../src/routes/README.md) | TanStack Start routing |
| [../supabase/seeds/README.md](../supabase/seeds/README.md) | Seed SQL из CSV |
| [../e2e/README.md](../e2e/README.md) | Playwright E2E |
| [../.env.docker.example](../.env.docker.example) | Шаблон env (генерировать, не править) |
| [../.env.example](../.env.example) | Минимальный env для host dev |

**Vendored (upstream, EN):** `docker/supabase/README.md`, `CONFIG.md` — только для низкоуровневой настройки Supabase; для ЕСЭДО используйте [docker/README.md](../docker/README.md).

---

## Лицензирование (кратко)

| Схема | EDMS | License server |
|-------|------|----------------|
| **Облако (Vercel)** | `LICENSE_SERVER_URL` → Vercel | `apps/cloud-license-server` |
| **Self-hosted vendor** | → vendor VPS | `compose:license-server` |
| **Replica** | → local LS | Local LS → Vercel upstream |

Подробности: [LICENSE-SERVER.md](./LICENSE-SERVER.md).

---

## Структура репозитория

```
flowmaster-core/
├── src/                         # ЕСЭДО — src/README.md, lib/api/README.md
├── supabase/migrations/         # PostgreSQL
├── docker/                      # Compose overrides, nginx, monitoring
├── docker-compose*.yml          # Entrypoints Compose (корень — по convention)
├── scripts/                     # env, orchestration — scripts/README.md
├── apps/cloud-license-server/   # Vercel LS
├── docs/                        # ← вы здесь (канонические guides)
├── wiki/                        # Wiki-страницы (+ GitHub Wiki)
├── e2e/                         # Playwright
└── CHANGELOG.md
```

---

## Соглашения

- **Домены в примерах:** `esedo.example.kz`, `license.example.kz`, `https://your-project.vercel.app`
- **Supabase keys:** ЕСЭДО — `SUPABASE_PUBLISHABLE_KEY`; cloud LS — `SUPABASE_ANON_KEY` ([ENV.md](./ENV.md#supabase-keys))
- **Якоря:** ASCII id в `LICENSE-SERVER.md` (`#edms-vercel-cloud`, `#docker-self-hosted`, `#replica-phase-2`)
- **Язык:** ops-доки — русский; `src/routes/README.md` — английский (TanStack)

---

## Карта по задачам

| Задача | Документ |
|--------|----------|
| Локальная разработка | [QUICKSTART.md](./QUICKSTART.md), [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Production on-prem | [DEPLOYMENT.md](./DEPLOYMENT.md), [ENV.md](./ENV.md) |
| Backup / инцидент | [RUNBOOK.md](./RUNBOOK.md) |
| Docker / ONLYOFFICE | [docker/README.md](../docker/README.md), [INTEGRATIONS.md](./INTEGRATIONS.md) |
| npm-скрипты | [scripts/README.md](../scripts/README.md) |
| CI / релиз | [CI.md](./CI.md), [CHANGELOG.md](../CHANGELOG.md) |
| Multi-tenant | [MULTI-TENANT.md](./MULTI-TENANT.md) |
| Безопасность | [SECURITY.md](./SECURITY.md) |
| Сбой / ошибка | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |

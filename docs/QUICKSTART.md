# Быстрый старт (5 минут)

Индекс: [README.md](./README.md).

Минимальный путь от clone до работающего ЕСЭДО на локальной машине.

## Требования

- Node.js **22 LTS**
- Docker Desktop + Compose v2
- Git

## Шаг 1 — клонирование и зависимости

```bash
git clone <repo-url> flowmaster-core
cd flowmaster-core
npm ci --legacy-peer-deps
```

## Шаг 2 — окружение и стек

```bash
npm run env:local
npm run docker:up
curl http://localhost/api/health
```

Ожидается: `{"ok":true,...,"database":"ok"}`.

## Шаг 3 — первый вход

1. Откройте **http://localhost** (или http://localhost:3000 при host dev)
2. Зарегистрируйте первого пользователя → роль **admin**
3. **Администрирование → Настройки** — при необходимости почта, LDAP, Telegram

## Альтернатива: hot reload на хосте

```bash
npm run env:local
npm run docker:deps    # только Supabase + миграции
npm run dev            # http://localhost:3000
```

## Полезные URL (local)

| Сервис | URL |
|--------|-----|
| ЕСЭДО (nginx) | http://localhost |
| ЕСЭДО (напрямую) | http://localhost:3000 |
| Supabase API | http://localhost:54321 |
| Postgres | 127.0.0.1:54322 |
| Studio | `npm run docker:up -- --studio` → :54323 |

## Облачные лицензии (z-license)

Кабинет и API: [https://z-license.vercel.app](https://z-license.vercel.app). Разработка и деплой облака — в отдельном репозитории **z-license**.

На EDMS см. [LICENSE-SERVER.md](./LICENSE-SERVER.md).

## Что дальше

| Роль | Документ |
|------|----------|
| Разработчик | [CONTRIBUTING.md](./CONTRIBUTING.md), [src/routes/README.md](../src/routes/README.md) |
| DevOps / production | [DEPLOYMENT.md](./DEPLOYMENT.md), [ENV.md](./ENV.md), [RUNBOOK.md](./RUNBOOK.md) |
| Лицензирование | [LICENSE-SERVER.md](./LICENSE-SERVER.md) |
| Интеграции | [INTEGRATIONS.md](./INTEGRATIONS.md), [api-v1.yaml](./api-v1.yaml) |
| Термины | [GLOSSARY.md](./GLOSSARY.md) |
| Проблемы | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |

Полный индекс: **[README.md](./README.md)**.

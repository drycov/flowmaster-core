# Разработка (contributing)

Индекс документации: [README.md](./README.md). Быстрый старт: [QUICKSTART.md](./QUICKSTART.md). Архитектура: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Требования

- Node.js **22 LTS**
- Docker + Compose v2 (для полного стека)
- Git

## Первый запуск

```bash
git clone <repo-url> flowmaster-core
cd flowmaster-core
npm ci --legacy-peer-deps   # --legacy-peer-deps: peer-deps TanStack/shadcn
npm run env:local
npm run docker:deps         # Supabase + миграции
npm run dev                 # http://localhost:3000
```

Полный стек в Docker: `npm run docker:up` — см. [корневой README](../README.md#быстрый-старт-разработка).

## Качество кода

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e            # нужны E2E_EMAIL / E2E_PASSWORD в .env
npm run test:e2e:ui         # Playwright UI mode
```

Подробнее: [e2e/README.md](../e2e/README.md).

CI (`.github/workflows/ci.yml`) запускает `lint`, `typecheck`, `test`; E2E и smoke — при наличии secrets.

## Маршруты и серверный код

- File-based routing: [src/routes/README.md](../src/routes/README.md)
- Обзор `src/`: [src/README.md](../src/README.md)
- Server Functions (API): [src/lib/api/README.md](../src/lib/api/README.md)
- Domain logic: `src/lib/{domain}/*.server.ts`
- Не редактируйте `src/routeTree.gen.ts` вручную

### `src/lib/api/` — соглашения

| Импорт | Когда |
|--------|--------|
| `@/lib/api/admin.functions` | Barrel split-модуля |
| `@/lib/api/hr.functions` | Доменный entry-point |
| `@/lib/api/document-access.server` | Shared helper |

Не импортируйте внутренние файлы вроде `admin/users.functions` — только barrels и публичные shims в корне `api/`.

## Миграции БД

Основное приложение: `supabase/migrations/`. После добавления SQL:

```bash
npm run docker:migrate
```

Облачный license server (**z-license**): отдельный репозиторий и Supabase-проект на Vercel — не в `flowmaster-core`.

## Секреты и git

- **Не коммитьте** `.env`, `.env.production`
- Шаблоны: `.env.docker.example`, `.env.example`
- Генерация env: `npm run env:*` — см. [ENV.md](./ENV.md), [scripts/README.md](../scripts/README.md)
- CI: [CI.md](./CI.md)

## Стиль изменений

- Минимальный diff, следуйте существующим паттернам в соседних файлах
- Документация на русском для ops; `src/routes/README.md` — на английском (TanStack)
- Обновляйте [docs/README.md](./README.md) при добавлении новых guide-файлов

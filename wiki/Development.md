# Разработка

**Полная версия:** [`docs/CONTRIBUTING.md`](../docs/CONTRIBUTING.md)

## Качество кода

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e          # E2E_EMAIL / E2E_PASSWORD в .env
```

## Маршруты

File-based routing (TanStack Start): `src/routes/README.md`

- Не редактировать `routeTree.gen.ts`
- API: `src/routes/api/`

## Миграции

```bash
# После новых SQL в supabase/migrations/
npm run docker:migrate
```

## Облачные лицензии

Проект [z-license](https://z-license.vercel.app) — отдельный репозиторий. В этом репо только клиентская связка EDMS → облако.

## E2E

`e2e/README.md` · `docs/CI.md`

## Секреты

Не коммитьте `.env`. Шаблон: `.env.docker.example`, генерация `npm run env:*`.

→ [Environment Variables](Environment-Variables)

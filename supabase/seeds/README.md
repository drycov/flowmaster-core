# Optional customer seed SQL

Документация проекта: [docs/README.md](../../docs/README.md). Staging / UAT: [docs/STAGING.md](../../docs/STAGING.md).

Demo and customer-specific data **не входят** в цепочку миграций.

Генерация из CSV:

```bash
node scripts/import-organization-csv.mjs org.csv
node scripts/import-org-csv.mjs departments.csv positions.csv
node scripts/import-nomenclature-csv.mjs nomenclature.csv
```

Файлы появятся здесь. Применение вручную:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -f - < supabase/seeds/seed_organization.sql
```

Автоматический `supabase/seed.sql` после migrate отключён по умолчанию (`APPLY_DB_SEED=0`).

## UAT multi-tenant fixture

Для cross-tenant smoke и Playwright (`e2e/tenant-isolation.spec.ts`):

```bash
npm run uat:seed-fixture
npm run uat:seed-fixture -- --print-env
```

Создаёт org B (`uat-tenant-b`), пользователей `@fixture.local`, документ `UAT-FIXTURE-001` в org A. Идempotent — повторный запуск безопасен.

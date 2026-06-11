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

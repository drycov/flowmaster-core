-- Optional post-migration seed (disabled by default: APPLY_DB_SEED=0).
-- Enable explicitly for local dev: APPLY_DB_SEED=1 in .env
-- Demo/customer data: generate via scripts/import-*-csv.mjs into supabase/seeds/ (manual apply).

SELECT public.get_system_init_status();

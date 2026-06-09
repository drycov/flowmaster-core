-- Local dev seed (runs after migrations on `supabase db reset`)
-- Idempotent — same reference data as 20260609170000_system_initialization.sql

SELECT public.get_system_init_status();

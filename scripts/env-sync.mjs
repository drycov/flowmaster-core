#!/usr/bin/env node
/** Copy .env → docker/supabase/.env for Docker Compose include paths. */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncSupabaseEnvOrExit } from "./lib/sync-supabase-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = syncSupabaseEnvOrExit(root);
console.log(`Synced ${result.source} → ${result.target}`);

#!/usr/bin/env node
/**
 * Validate cloud license server Supabase migrations.
 *
 *   node scripts/validate-migrations.mjs           # file naming / order
 *   node scripts/validate-migrations.mjs --apply   # apply to DATABASE_URL
 *
 * CI: postgres service + --apply
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const apply = process.argv.includes("--apply");

async function listMigrationFiles() {
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) throw new Error("no migration files found");
  let prev = 0;
  for (const file of files) {
    if (!/^\d{3}_[a-z0-9_]+\.sql$/i.test(file)) {
      throw new Error(`invalid migration filename: ${file}`);
    }
    const num = Number(file.slice(0, 3));
    if (!Number.isFinite(num) || num <= prev) {
      throw new Error(`migration order broken at ${file}`);
    }
    prev = num;
  }
  return files;
}

function applyMigrations(files) {
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.CLOUD_LICENSE_DATABASE_URL?.trim() ||
    "postgresql://postgres:postgres@localhost:5432/postgres";

  for (const file of files) {
    const sqlPath = join(migrationsDir, file);
    console.log(`Applying ${file}…`);
    const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
      encoding: "utf8",
      stdio: "pipe",
    });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      throw new Error(`failed to apply ${file}`);
    }
  }
}

async function main() {
  const files = await listMigrationFiles();
  console.log(`Found ${files.length} migration(s): ${files.join(", ")}`);

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    if (!sql.trim()) throw new Error(`${file} is empty`);
  }

  if (apply) {
    const psql = spawnSync("psql", ["--version"], { encoding: "utf8", stdio: "pipe" });
    if (psql.status !== 0) {
      throw new Error("psql not found — install postgresql-client or use CI postgres service");
    }
    applyMigrations(files);
    console.log("All migrations applied successfully");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

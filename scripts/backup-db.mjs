#!/usr/bin/env node
/**
 * Automated PostgreSQL backup for Docker Supabase stack.
 *
 *   npm run backup:db
 *   npm run backup:db -- --storage
 *   npm run backup:db -- --dir=/var/backups/edms
 *
 * Host cron (daily 02:00):
 *   0 2 * * * cd /opt/edms && npm run backup:db >> /var/log/edms-backup.log 2>&1
 *
 * Env: DB_CONTAINER, POSTGRES_USER, POSTGRES_DB, BACKUP_DIR, BACKUP_RETENTION_DAYS
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvFiles, repoRoot } from "./lib/load-env.mjs";

function flag(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (next && !next.startsWith("-")) return next;
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

loadEnvFiles([".env", ".env.production"]);

const includeStorage = hasFlag("--storage");
const verifyOnly = flag("--verify-only", "");
const backupDir = resolve(
  flag("--dir", process.env.BACKUP_DIR?.trim() || join(repoRoot, "backups")),
);
const container = process.env.DB_CONTAINER?.trim() || "supabase-db";
const pgUser = process.env.POSTGRES_USER?.trim() || "postgres";
const pgDb = process.env.POSTGRES_DB?.trim() || process.env.POSTGRES_DB_NAME?.trim() || "postgres";
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? "30");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`${cmd} ${args.join(" ")} failed: ${detail}`);
  }
}

function dockerAvailable() {
  const r = spawnSync("docker", ["info"], { encoding: "utf8", stdio: "pipe" });
  return r.status === 0;
}

function containerRunning(name) {
  const r = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", name], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return r.status === 0 && r.stdout.trim() === "true";
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

function verifyDump(path) {
  if (!existsSync(path)) throw new Error(`backup file missing: ${path}`);
  const size = statSync(path).size;
  if (size < 1024) throw new Error(`backup too small (${size} bytes): ${path}`);
  console.log(`Verified ${path} (${(size / 1024 / 1024).toFixed(2)} MiB)`);
}

function pruneOldBackups(dir) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;
  const cutoff = Date.now() - retentionDays * 86_400_000;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (!/^backup-/.test(name) && !/^storage-/.test(name)) continue;
    const path = join(dir, name);
    try {
      if (statSync(path).mtimeMs < cutoff) {
        unlinkSync(path);
        removed += 1;
        console.log(`Pruned old backup: ${name}`);
      }
    } catch {
      // ignore
    }
  }
  if (removed === 0) console.log(`Retention: nothing older than ${retentionDays} days`);
}

function backupDatabase(dir) {
  mkdirSync(dir, { recursive: true });
  const outFile = join(dir, `backup-${timestamp()}.dump`);
  console.log(`Backing up ${pgDb}@${container} → ${outFile}`);

  const result = spawnSync(
    "docker",
    ["exec", container, "pg_dump", "-U", pgUser, "-Fc", pgDb],
    { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    const err = result.stderr?.toString("utf8").trim() || `exit ${result.status}`;
    throw new Error(`pg_dump failed: ${err}`);
  }

  writeFileSync(outFile, result.stdout);
  verifyDump(outFile);
  return outFile;
}

function backupStorage(dir) {
  const storageRoot = join(repoRoot, "docker", "supabase", "volumes", "storage");
  if (!existsSync(storageRoot)) {
    console.log("Storage volume not found — skip (expected on fresh install)");
    return null;
  }
  mkdirSync(dir, { recursive: true });
  const outFile = join(dir, `storage-${timestamp()}.tar.gz`);
  console.log(`Archiving storage → ${outFile}`);
  run("tar", ["-czf", outFile, "-C", join(repoRoot, "docker", "supabase", "volumes"), "storage"]);
  verifyDump(outFile);
  return outFile;
}

function main() {
  if (verifyOnly) {
    verifyDump(resolve(verifyOnly));
    return;
  }

  if (!dockerAvailable()) {
    console.error("Docker is not available");
    process.exit(1);
  }
  if (!containerRunning(container)) {
    console.error(
      `Container ${container} is not running — start stack first (npm run compose:tls:cron)`,
    );
    process.exit(1);
  }

  const dbFile = backupDatabase(backupDir);
  const storageFile = includeStorage ? backupStorage(backupDir) : null;
  pruneOldBackups(backupDir);

  console.log("");
  console.log("Backup complete");
  console.log(`  DB:  ${dbFile}`);
  if (storageFile) console.log(`  Storage: ${storageFile}`);
  console.log(`  Dir: ${backupDir}`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

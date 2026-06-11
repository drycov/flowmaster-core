#!/usr/bin/env node
/**
 * Wait until self-hosted Supabase Kong responds.
 *
 * Usage:
 *   node scripts/docker-wait.mjs
 *   SUPABASE_PUBLIC_URL=http://127.0.0.1:54321 node scripts/docker-wait.mjs
 */

const base = (
  process.env.SUPABASE_PUBLIC_URL ??
  process.env.VITE_SUPABASE_URL ??
  "http://localhost:54321"
).replace(/\/$/, "");

const timeoutMs = Number(process.env.DOCKER_WAIT_TIMEOUT_MS ?? 180_000);
const intervalMs = Number(process.env.DOCKER_WAIT_INTERVAL_MS ?? 2_000);
const started = Date.now();

const probes = [`${base}/rest/v1/`, `${base}/auth/v1/health`];

async function probe(url) {
  const res = await fetch(url, {
    headers: { apikey: process.env.ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
    signal: AbortSignal.timeout(5_000),
  });
  return res.ok || res.status === 401 || res.status === 404;
}

async function ready() {
  for (const url of probes) {
    try {
      if (await probe(url)) return true;
    } catch {
      /* retry */
    }
  }
  return false;
}

console.log(`Waiting for Supabase at ${base} ...`);

while (Date.now() - started < timeoutMs) {
  if (await ready()) {
    console.log(`Supabase is ready (${Math.round((Date.now() - started) / 1000)}s)`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}

console.error(`Timeout after ${timeoutMs}ms — is docker compose running?`);
process.exit(1);

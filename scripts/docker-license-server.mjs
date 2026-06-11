#!/usr/bin/env node
/**
 * Start vendor license server stack (TLS + app + Supabase).
 *
 *   npm run compose:license-server
 */

import { loadEnvFiles } from "./lib/load-env.mjs";
import { orchestrateStack, printStackUrls } from "./lib/docker-orchestrate.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

loadEnvFiles([".env", ".env.license-server"]);

orchestrateStack(root, {
  stack: "licenseServer",
  envHint: "npm run env:license-server -- --domain=license.example.kz --install",
  label: "License server (HTTPS)",
});

printStackUrls(root, { stack: "licenseServer", tls: true });

const domain = process.env.PROXY_DOMAIN?.trim();
if (domain) {
  console.log(`  License API:  curl https://${domain}/api/v1/license/health`);
}

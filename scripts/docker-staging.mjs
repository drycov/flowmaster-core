#!/usr/bin/env node
/**
 * Staging / UAT stack with migrate + wait.
 *
 *   npm run compose:staging
 */

import { loadEnvFiles } from "./lib/load-env.mjs";
import { orchestrateStack, printStackUrls } from "./lib/docker-orchestrate.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

loadEnvFiles([".env"]);

orchestrateStack(root, {
  stack: "staging",
  envHint: "npm run env:staging",
  restartServices: ["app", "nginx", "cron"],
});

printStackUrls(root, { stack: "staging" });

#!/usr/bin/env node
/** @deprecated Use: npm run env:production */
import { runEnvSetup } from "./env-setup.mjs";

const argv = ["production", ...process.argv.slice(2)];
process.exit(runEnvSetup(argv));

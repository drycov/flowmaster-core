#!/usr/bin/env node
/** @deprecated Use: npm run env:local */
import { runEnvSetup } from "./env-setup.mjs";

process.exit(runEnvSetup(process.argv.slice(2)));

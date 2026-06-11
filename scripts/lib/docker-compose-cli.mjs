/** Shared Docker Compose CLI args for Flowmaster stacks. */

export const OPTIONAL_PROFILES = ["cron", "studio", "monitoring", "office"];

/** Profiles started by `docker-full.mjs` / `compose:*:full`. */
export const FULL_PROFILES = ["cron", "studio", "monitoring"];

/** Named compose entrypoints (root docker-compose*.yml). */
export const STACKS = {
  http: { files: ["docker-compose.yml"], label: "HTTP production" },
  tls: { files: ["docker-compose.tls.yml"], label: "HTTPS production" },
  staging: { files: ["docker-compose.staging.yml"], label: "Staging / UAT" },
  licenseServer: { files: ["docker-compose.license-server.yml"], label: "License server" },
  dev: { files: ["docker-compose.dev.yml"], label: "Supabase backend (dev)", dev: true },
};

export function resolveStackId({ stack, tls = false, dev = false } = {}) {
  if (stack && STACKS[stack]) return stack;
  if (dev) return "dev";
  if (tls) return "tls";
  return "http";
}

export function resolveComposeFiles({ stack, tls = false, dev = false, monitoring = false } = {}) {
  const stackId = resolveStackId({ stack, tls, dev });
  const files = [...STACKS[stackId].files];
  if (monitoring) files.push("docker-compose.monitoring.yml");
  return files;
}

export function composeBaseArgs(files) {
  const args = ["compose"];
  for (const file of files) {
    args.push("-f", file);
  }
  return args;
}

export function composeProfileArgs(profiles) {
  const args = [];
  for (const profile of profiles) {
    args.push("--profile", profile);
  }
  return args;
}

export function buildComposeCommand({
  stack,
  tls = false,
  dev = false,
  profiles = [],
  subcommand = [],
} = {}) {
  const wantsMonitoring = profiles.includes("monitoring");
  const files = resolveComposeFiles({ stack, tls, dev, monitoring: wantsMonitoring });
  return [...composeBaseArgs(files), ...composeProfileArgs(profiles), ...subcommand];
}

export function buildComposeDownCommand({ stack, tls = false, dev = false } = {}) {
  return [...composeBaseArgs(resolveComposeFiles({ stack, tls, dev })), "down"];
}

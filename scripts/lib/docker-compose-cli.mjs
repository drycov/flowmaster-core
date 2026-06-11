/** Shared Docker Compose CLI args for Flowmaster stacks. */

export const OPTIONAL_PROFILES = ["cron", "studio", "monitoring"];

export const FULL_PROFILES = ["cron", "studio", "monitoring"];

export function resolveComposeFiles({ tls = false, dev = false, monitoring = false } = {}) {
  if (dev) return ["docker-compose.dev.yml"];
  const files = [tls ? "docker-compose.tls.yml" : "docker-compose.yml"];
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
  tls = false,
  dev = false,
  profiles = [],
  subcommand = [],
} = {}) {
  const wantsMonitoring = profiles.includes("monitoring");
  const files = resolveComposeFiles({ tls, dev, monitoring: wantsMonitoring });
  return [...composeBaseArgs(files), ...composeProfileArgs(profiles), ...subcommand];
}

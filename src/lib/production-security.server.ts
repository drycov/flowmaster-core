import { getInternalHookSecret } from "@/lib/internal-hook-auth.server";
import { isOnlyOfficeJwtEnabled } from "@/lib/office/jwt.server";
import { logger } from "@/lib/logger.server";

export type ProductionSecurityIssue = {
  code: "cron_secret" | "onlyoffice_jwt";
  message: string;
};

/** Checks that production-critical secrets are configured. */
export function collectProductionSecurityIssues(): ProductionSecurityIssue[] {
  if (process.env.NODE_ENV !== "production") return [];

  const issues: ProductionSecurityIssue[] = [];

  if (!getInternalHookSecret()) {
    issues.push({
      code: "cron_secret",
      message: "Задайте CRON_SECRET или INTERNAL_HOOK_SECRET для cron hooks",
    });
  }

  if (!isOnlyOfficeJwtEnabled()) {
    issues.push({
      code: "onlyoffice_jwt",
      message: "Задайте ONLYOFFICE_JWT_ENABLED=true и ONLYOFFICE_JWT_SECRET для save callback",
    });
  }

  return issues;
}

/** Log warnings on startup; in strict mode throw (Docker production). */
export function assertProductionSecurityConfig(opts?: { strict?: boolean }): void {
  const issues = collectProductionSecurityIssues();
  if (issues.length === 0) return;

  for (const issue of issues) {
    logger.error("production security config", { code: issue.code, message: issue.message });
  }

  const strict = opts?.strict ?? process.env.PRODUCTION_STRICT_SECURITY === "true";
  if (strict) {
    throw new Error(
      `Production security misconfiguration: ${issues.map((i) => i.code).join(", ")}`,
    );
  }
}

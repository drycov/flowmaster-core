import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModuleAccess } from "@/lib/access/enforcement.server";
import { runHealthChecks } from "@/lib/health/server";
import { loadSystemInitStatus, type SystemInitStatus } from "@/lib/system/init-status.server";

export type SystemMonitoringStatus = {
  ok: boolean;
  checks: Record<string, string>;
  checked_at: string;
  uptime_seconds: number;
  node_env: string;
  sentry_configured: boolean;
  grafana_url: string | null;
  init: SystemInitStatus;
};

export const getSystemMonitoringStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(context.supabase, context.userId, "monitoring", { action: "read" });

    const [{ ok, checks }, init] = await Promise.all([
      runHealthChecks(),
      loadSystemInitStatus(),
    ]);

    return {
      ok,
      checks,
      checked_at: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      node_env: process.env.NODE_ENV ?? "development",
      sentry_configured: Boolean(process.env.SENTRY_DSN),
      grafana_url: process.env.MONITORING_GRAFANA_URL?.trim() || null,
      init,
    } satisfies SystemMonitoringStatus;
  });

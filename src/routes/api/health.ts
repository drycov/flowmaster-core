import { createFileRoute } from "@tanstack/react-router";
import { runHealthChecks } from "@/lib/health/server";
import { logger } from "@/lib/logger.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { ok, checks } = await runHealthChecks();
        if (!ok) {
          logger.warn("health check degraded", { checks });
        }
        return new Response(JSON.stringify({ ok, checks }), {
          status: ok ? 200 : 503,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

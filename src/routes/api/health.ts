import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "@/lib/logger.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const checks: Record<string, string> = { app: "ok" };

        try {
          const { error } = await supabaseAdmin
            .from("organization" as never)
            .select("id")
            .limit(1)
            .maybeSingle();
          checks.database = error ? "error" : "ok";
          if (error) checks.database_error = error.message;
        } catch (e) {
          checks.database = "error";
          checks.database_error = e instanceof Error ? e.message : String(e);
        }

        try {
          const { data, error } = await supabaseAdmin.rpc("get_license_status" as never);
          if (error) {
            checks.license = "error";
            checks.license_error = error.message;
          } else {
            const status = data as { status?: string } | null;
            checks.license = status?.status ?? "unknown";
          }
        } catch (e) {
          checks.license = "error";
          checks.license_error = e instanceof Error ? e.message : String(e);
        }

        const healthy = checks.database === "ok";
        if (!healthy) {
          logger.warn("health check degraded", { checks });
        }
        return new Response(JSON.stringify({ ok: healthy, checks }), {
          status: healthy ? 200 : 503,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

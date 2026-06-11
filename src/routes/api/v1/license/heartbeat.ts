import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { heartbeatOnLicenseServer } from "@/lib/license/server/registry.server";
import { assertLicenseServerEnabled } from "@/lib/license/server/route-auth.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/v1/license/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const disabled = assertLicenseServerEnabled();
        if (disabled) return disabled;

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const token = String(body.token ?? "").trim();
        const installation_id = String(body.installation_id ?? "").trim();
        if (!token || !installation_id) {
          return json({ error: "token and installation_id required" }, 400);
        }

        try {
          const result = await heartbeatOnLicenseServer(supabaseAdmin, {
            token,
            installation_id,
            active_users: body.active_users !== undefined ? Number(body.active_users) : undefined,
            hostname: body.hostname ? String(body.hostname) : undefined,
            app_version: body.app_version ? String(body.app_version) : undefined,
          });
          return json(result);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 500);
        }
      },
    },
  },
});

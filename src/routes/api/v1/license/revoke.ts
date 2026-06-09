import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  revokeOnLicenseServer,
  verifyLicenseServerAdmin,
} from "@/lib/license/server/registry.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/v1/license/revoke")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyLicenseServerAdmin(request)) {
          return json({ error: "Unauthorized" }, 401);
        }

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        try {
          const result = await revokeOnLicenseServer(supabaseAdmin, {
            key_id: body.key_id ? String(body.key_id) : undefined,
            installation_id: body.installation_id ? String(body.installation_id) : undefined,
            key_hash: body.key_hash ? String(body.key_hash) : undefined,
            reason: body.reason ? String(body.reason) : undefined,
          });
          return json({ ok: true, ...result });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 400);
        }
      },
    },
  },
});

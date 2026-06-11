import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  registerLicenseKeyOnServer,
  verifyLicenseServerAdmin,
} from "@/lib/license/server/registry.server";
import { assertLicenseServerEnabled } from "@/lib/license/server/route-auth.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/v1/license/register-key")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const disabled = assertLicenseServerEnabled();
        if (disabled) return disabled;

        if (!verifyLicenseServerAdmin(request)) {
          return json({ error: "Unauthorized" }, 401);
        }

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const license_key = String(body.license_key ?? "").trim();
        if (!license_key) {
          return json({ error: "license_key required" }, 400);
        }

        try {
          const result = await registerLicenseKeyOnServer(supabaseAdmin, license_key);
          return json({ ok: true, ...result });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 400);
        }
      },
    },
  },
});

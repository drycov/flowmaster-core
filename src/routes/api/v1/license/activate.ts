import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { activateOnLicenseServer } from "@/lib/license/server/registry.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/v1/license/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const license_key = String(body.license_key ?? "").trim();
        const installation_id = String(body.installation_id ?? "").trim();
        if (!license_key || !installation_id) {
          return json({ error: "license_key and installation_id required" }, 400);
        }

        try {
          const result = await activateOnLicenseServer(supabaseAdmin, {
            license_key,
            installation_id,
            hostname: body.hostname ? String(body.hostname) : undefined,
            app_version: body.app_version ? String(body.app_version) : undefined,
          });
          return json(result);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 400);
        }
      },
    },
  },
});

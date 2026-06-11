import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAppVersion, isLicenseServerEnabled } from "@/lib/license/server/config.server";
import { assertLicenseServerEnabled } from "@/lib/license/server/route-auth.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/v1/license/health")({
  server: {
    handlers: {
      GET: async () => {
        const disabled = assertLicenseServerEnabled();
        if (disabled) return disabled;

        let keys = 0;
        let activations = 0;
        try {
          const [{ count: keyCount }, { count: actCount }] = await Promise.all([
            supabaseAdmin
              .from("license_server_keys" as never)
              .select("id", { count: "exact", head: true }),
            supabaseAdmin
              .from("license_server_activations" as never)
              .select("id", { count: "exact", head: true })
              .eq("status", "active" as never),
          ]);
          keys = keyCount ?? 0;
          activations = actCount ?? 0;
        } catch {
          return json({ ok: false, role: "license-server", error: "database" }, 503);
        }

        return json({
          ok: true,
          role: "license-server",
          enabled: isLicenseServerEnabled(),
          version: getAppVersion(),
          keys,
          active_activations: activations,
        });
      },
    },
  },
});

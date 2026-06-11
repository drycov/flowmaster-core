import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  unauthorizedHookResponse,
  verifyInternalHookRequest,
} from "@/lib/internal-hook-auth.server";
import {
  runUpstreamReplicaSync,
  upstreamReplicaEnabled,
} from "@/lib/license/server/upstream-sync.server";

export const Route = createFileRoute("/api/public/hooks/license-upstream-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyInternalHookRequest(request)) {
          return unauthorizedHookResponse();
        }

        if (!upstreamReplicaEnabled()) {
          return new Response(
            JSON.stringify({ ok: true, skipped: true, reason: "upstream_replica_not_configured" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const result = await runUpstreamReplicaSync(supabaseAdmin);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import {
  unauthorizedHookResponse,
  verifyInternalHookRequest,
} from "@/lib/internal-hook-auth.server";
import { licenseServerAvailable, syncLicenseWithServerSoft } from "@/lib/license/server/client.server";

export const Route = createFileRoute("/api/public/hooks/license-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyInternalHookRequest(request)) {
          return unauthorizedHookResponse();
        }

        if (!licenseServerAvailable()) {
          return new Response(
            JSON.stringify({ ok: true, skipped: true, reason: "license_server_not_configured" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const status = await syncLicenseWithServerSoft();
          return new Response(
            JSON.stringify({
              ok: true,
              status: status.status,
              last_sync_ok: status.last_sync_ok,
              offline_mode: status.offline_mode,
              server_revoked: status.server_revoked,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({
              ok: true,
              offline: true,
              error: e instanceof Error ? e.message : String(e),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

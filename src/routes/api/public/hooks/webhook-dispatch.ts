import { createFileRoute } from "@tanstack/react-router";
import { dispatchWebhookOutbox } from "@/lib/integrations/webhooks.server";
import {
  unauthorizedHookResponse,
  verifyInternalHookRequest,
} from "@/lib/internal-hook-auth.server";

export const Route = createFileRoute("/api/public/hooks/webhook-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyInternalHookRequest(request)) {
          return unauthorizedHookResponse();
        }

        try {
          const result = await dispatchWebhookOutbox(50);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

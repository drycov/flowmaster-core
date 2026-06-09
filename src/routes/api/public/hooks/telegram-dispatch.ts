import { createFileRoute } from "@tanstack/react-router";
import {
  unauthorizedHookResponse,
  verifyInternalHookRequest,
} from "@/lib/internal-hook-auth.server";
import { processTelegramOutbox } from "@/lib/telegram/outbox.server";

export const Route = createFileRoute("/api/public/hooks/telegram-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyInternalHookRequest(request)) {
          return unauthorizedHookResponse();
        }

        try {
          const result = await processTelegramOutbox();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "telegram dispatch error";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

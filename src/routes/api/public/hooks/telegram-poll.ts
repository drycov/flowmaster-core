import { createFileRoute } from "@tanstack/react-router";
import {
  unauthorizedHookResponse,
  verifyInternalHookRequest,
} from "@/lib/internal-hook-auth.server";
import {
  ensureTelegramPolling,
  getTelegramDeliveryMode,
  isTelegramWebhookActive,
  pollTelegramUpdatesOnce,
} from "@/lib/telegram/polling.server";

export const Route = createFileRoute("/api/public/hooks/telegram-poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyInternalHookRequest(request)) {
          return unauthorizedHookResponse();
        }

        try {
          const mode = await getTelegramDeliveryMode();
          if (mode === "off") {
            return new Response(JSON.stringify({ ok: true, mode, processed: 0 }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (await isTelegramWebhookActive()) {
            return new Response(
              JSON.stringify({ ok: true, mode: "webhook", processed: 0, skipped: true }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          const url = new URL(request.url);
          const background = url.searchParams.get("background") === "1";
          if (background) {
            void ensureTelegramPolling();
            return new Response(JSON.stringify({ ok: true, mode: "polling", background: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const processed = await pollTelegramUpdatesOnce(0);
          return new Response(JSON.stringify({ ok: true, mode: "polling", processed }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "telegram poll error";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

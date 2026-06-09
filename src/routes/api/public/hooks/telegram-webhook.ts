import { createFileRoute } from "@tanstack/react-router";
import { loadSystemSettings } from "@/lib/auth/policy";
import type { TelegramUpdate } from "@/lib/telegram/api.server";
import { handleTelegramUpdate } from "@/lib/telegram/bot.server";
import { stopTelegramPolling } from "@/lib/telegram/polling.server";

export const Route = createFileRoute("/api/public/hooks/telegram-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const settings = await loadSystemSettings();
        const expectedSecret = settings.telegram.webhook_secret?.trim();
        if (!expectedSecret) {
          return new Response("Webhook secret not configured", { status: 503 });
        }
        const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
        if (headerSecret !== expectedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: TelegramUpdate;
        try {
          update = (await request.json()) as TelegramUpdate;
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        try {
          stopTelegramPolling();
          await handleTelegramUpdate(update);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "telegram webhook error";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

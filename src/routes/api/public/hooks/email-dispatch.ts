import { createFileRoute } from "@tanstack/react-router";
import { processEmailOutbox } from "@/lib/email/outbox.server";
import {
  unauthorizedHookResponse,
  verifyInternalHookRequest,
} from "@/lib/internal-hook-auth.server";
import { processDutyReminders } from "@/lib/scheduling/duty-reminders.server";
import { processTelegramOutbox } from "@/lib/telegram/outbox.server";

export const Route = createFileRoute("/api/public/hooks/email-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyInternalHookRequest(request)) {
          return unauthorizedHookResponse();
        }

        try {
          const [email, telegram, dutyReminders] = await Promise.all([
            processEmailOutbox(),
            processTelegramOutbox(),
            processDutyReminders(),
          ]);
          return new Response(JSON.stringify({ ok: true, email, telegram, dutyReminders }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "email dispatch error";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { processOfficeCallback } from "@/lib/office/office.server";
import { verifyOnlyOfficeCallbackRequest } from "@/lib/office/office-callback-auth.server";

export const Route = createFileRoute("/api/public/hooks/office-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 1, message: "invalid json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const body = verifyOnlyOfficeCallbackRequest(request, rawBody);
        if (!body) {
          return new Response(JSON.stringify({ error: 1, message: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const result = await processOfficeCallback(body);
          return new Response(JSON.stringify({ error: 0, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "office callback error";
          return new Response(JSON.stringify({ error: 1, message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

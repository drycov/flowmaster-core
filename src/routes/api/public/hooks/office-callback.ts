import { createFileRoute } from "@tanstack/react-router";
import { processOfficeCallback } from "@/lib/office/office.server";

export const Route = createFileRoute("/api/public/hooks/office-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            key?: string;
            status?: number;
            url?: string;
          };
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

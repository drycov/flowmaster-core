import { createFileRoute } from "@tanstack/react-router";

/** Liveness probe — HTTP 200 when the Node process serves routes (no DB dependency). */
export const Route = createFileRoute("/api/health/live")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, checks: { app: "ok" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});

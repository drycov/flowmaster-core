import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateApiKey,
  apiError,
  jsonResponse,
  requireScope,
} from "@/lib/integrations/api-key-auth.server";
import { v1ListTasks } from "@/lib/integrations/v1/handlers.server";

export const Route = createFileRoute("/api/v1/tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticateApiKey(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "tasks:read")) {
          return apiError("Missing scope: tasks:read", 403);
        }

        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? "100");

        try {
          const tasks = await v1ListTasks(ctx, { status, limit });
          return jsonResponse({ data: tasks });
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
    },
  },
});

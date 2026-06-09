import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateApiKey,
  apiError,
  jsonResponse,
  requireScope,
} from "@/lib/integrations/api-key-auth.server";
import { v1CompleteTask } from "@/lib/integrations/v1/handlers.server";

export const Route = createFileRoute("/api/v1/tasks/$id/complete")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const ctx = await authenticateApiKey(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "tasks:write")) {
          return apiError("Missing scope: tasks:write", 403);
        }

        let body: { decision?: string; comment?: string };
        try {
          body = (await request.json()) as { decision?: string; comment?: string };
        } catch {
          return apiError("Invalid JSON", 400);
        }

        const decision = body.decision;
        if (decision !== "approve" && decision !== "reject" && decision !== "return") {
          return apiError("decision must be approve, reject, or return", 400);
        }

        try {
          const result = await v1CompleteTask(ctx, params.id, {
            decision,
            comment: body.comment ?? null,
          });
          if (!result) return apiError("Not found or not assignee", 404);
          return jsonResponse(result);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
    },
  },
});

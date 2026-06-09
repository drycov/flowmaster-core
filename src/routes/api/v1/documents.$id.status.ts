import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateApiKey,
  apiError,
  jsonResponse,
  requireScope,
} from "@/lib/integrations/api-key-auth.server";
import { v1UpdateDocumentStatus } from "@/lib/integrations/v1/handlers.server";

export const Route = createFileRoute("/api/v1/documents/$id/status")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const ctx = await authenticateApiKey(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "documents:write")) {
          return apiError("Missing scope: documents:write", 403);
        }

        let body: { status?: string };
        try {
          body = await request.json();
        } catch {
          return apiError("Invalid JSON body");
        }

        if (!body.status) return apiError("status is required");

        try {
          const doc = await v1UpdateDocumentStatus(ctx, params.id, body.status);
          if (!doc) return apiError("Not found or forbidden", 404);
          return jsonResponse(doc);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
    },
  },
});

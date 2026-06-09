import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateApiKey,
  apiError,
  jsonResponse,
  requireScope,
} from "@/lib/integrations/api-key-auth.server";
import { v1CreateDocumentVersion } from "@/lib/integrations/v1/handlers.server";

export const Route = createFileRoute("/api/v1/documents/$id/versions")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const ctx = await authenticateApiKey(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "documents:write")) {
          return apiError("Missing scope: documents:write", 403);
        }

        let body: { body?: string; comment?: string };
        try {
          body = (await request.json()) as { body?: string; comment?: string };
        } catch {
          return apiError("Invalid JSON", 400);
        }

        if (!body.body?.trim()) {
          return apiError("body is required", 400);
        }

        try {
          const version = await v1CreateDocumentVersion(ctx, params.id, {
            body: body.body,
            comment: body.comment ?? null,
          });
          if (!version) return apiError("Not found", 404);
          return jsonResponse(version, 201);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
    },
  },
});

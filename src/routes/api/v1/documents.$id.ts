import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateApiKey,
  apiError,
  jsonResponse,
  requireScope,
} from "@/lib/integrations/api-key-auth.server";
import { v1GetDocument, v1UpdateDocument } from "@/lib/integrations/v1/handlers.server";

export const Route = createFileRoute("/api/v1/documents/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ctx = await authenticateApiKey(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "documents:read")) {
          return apiError("Missing scope: documents:read", 403);
        }

        try {
          const doc = await v1GetDocument(ctx, params.id);
          if (!doc) return apiError("Not found", 404);
          return jsonResponse(doc);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
      PATCH: async ({ request, params }) => {
        const ctx = await authenticateApiKey(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "documents:write")) {
          return apiError("Missing scope: documents:write", 403);
        }

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return apiError("Invalid JSON", 400);
        }

        try {
          const doc = await v1UpdateDocument(ctx, params.id, {
            title_ru: typeof body.title_ru === "string" ? body.title_ru : undefined,
            title_kk: typeof body.title_kk === "string" ? body.title_kk : undefined,
            summary: typeof body.summary === "string" ? body.summary : undefined,
            body: typeof body.body === "string" ? body.body : undefined,
            external_reg_number:
              typeof body.external_reg_number === "string" ? body.external_reg_number : undefined,
            due_at: typeof body.due_at === "string" ? body.due_at : undefined,
          });
          if (!doc) return apiError("Not found", 404);
          return jsonResponse(doc);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
    },
  },
});

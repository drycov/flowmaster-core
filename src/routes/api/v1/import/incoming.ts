import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateApiKey,
  apiError,
  jsonResponse,
  requireScope,
} from "@/lib/integrations/api-key-auth.server";
import { v1ImportIncoming } from "@/lib/integrations/v1/handlers.server";

export const Route = createFileRoute("/api/v1/import/incoming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await authenticateApiKey(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "import:write")) {
          return apiError("Missing scope: import:write", 403);
        }

        let body: { items?: unknown[] };
        try {
          body = await request.json();
        } catch {
          return apiError("Invalid JSON body");
        }

        if (!Array.isArray(body.items) || body.items.length === 0) {
          return apiError("items array is required");
        }
        if (body.items.length > 500) {
          return apiError("Maximum 500 items per request");
        }

        const items = body.items.map((item, i) => {
          const row = item as Record<string, unknown>;
          if (typeof row.title_ru !== "string" || !row.title_ru.trim()) {
            throw new Error(`items[${i}].title_ru is required`);
          }
          return {
            title_ru: row.title_ru.trim(),
            title_kk: typeof row.title_kk === "string" ? row.title_kk : null,
            summary: typeof row.summary === "string" ? row.summary : null,
            body: typeof row.body === "string" ? row.body : null,
            external_reg_number:
              typeof row.external_reg_number === "string" ? row.external_reg_number : null,
            correspondent_code:
              typeof row.correspondent_code === "string" ? row.correspondent_code : null,
            received_at: typeof row.received_at === "string" ? row.received_at : null,
          };
        });

        try {
          const result = await v1ImportIncoming(ctx, items, ctx.keyId);
          return jsonResponse(result, 201);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
    },
  },
});

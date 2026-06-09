import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateApiKey,
  apiError,
  jsonResponse,
  requireScope,
} from "@/lib/integrations/api-key-auth.server";
import { v1CreateDocument, v1ListDocuments } from "@/lib/integrations/v1/handlers.server";

async function auth(request: Request) {
  const ctx = await authenticateApiKey(request);
  if (!ctx) return null;
  return ctx;
}

export const Route = createFileRoute("/api/v1/documents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await auth(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "documents:read")) {
          return apiError("Missing scope: documents:read", 403);
        }

        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? "50");
        const offset = Number(url.searchParams.get("offset") ?? "0");

        try {
          const result = await v1ListDocuments(ctx, { status, limit, offset });
          return jsonResponse(result);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
      POST: async ({ request }) => {
        const ctx = await auth(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "documents:write")) {
          return apiError("Missing scope: documents:write", 403);
        }

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return apiError("Invalid JSON body");
        }

        if (typeof body.title_ru !== "string" || !body.title_ru.trim()) {
          return apiError("title_ru is required");
        }

        try {
          const doc = await v1CreateDocument(ctx, {
            title_ru: body.title_ru.trim(),
            title_kk: typeof body.title_kk === "string" ? body.title_kk : null,
            summary: typeof body.summary === "string" ? body.summary : null,
            body: typeof body.body === "string" ? body.body : null,
            document_type_code:
              typeof body.document_type_code === "string" ? body.document_type_code : undefined,
            external_reg_number:
              typeof body.external_reg_number === "string" ? body.external_reg_number : null,
            received_at: typeof body.received_at === "string" ? body.received_at : null,
          });
          return jsonResponse(doc, 201);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
    },
  },
});

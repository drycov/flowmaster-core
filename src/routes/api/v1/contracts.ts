import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateApiKey,
  apiError,
  jsonResponse,
  requireScope,
} from "@/lib/integrations/api-key-auth.server";
import { v1ListContracts } from "@/lib/integrations/v1/handlers.server";

export const Route = createFileRoute("/api/v1/contracts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticateApiKey(request);
        if (!ctx) return apiError("Unauthorized", 401);
        if (!requireScope(ctx, "contracts:read")) {
          return apiError("Missing scope: contracts:read", 403);
        }

        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? "50");
        const offset = Number(url.searchParams.get("offset") ?? "0");

        try {
          const result = await v1ListContracts(ctx, { status, limit, offset });
          return jsonResponse(result);
        } catch (e) {
          return apiError(e instanceof Error ? e.message : "Error", 500);
        }
      },
    },
  },
});

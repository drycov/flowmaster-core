import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyDocumentStatusTransition } from "@/lib/documents/status-transition.server";
import { canViewDocumentContent } from "@/lib/api/document-access.server";
import { requireModuleAccess } from "./_helpers";

const bulkActionSchema = z.object({
  document_ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["archive", "assign", "status"]),
  assignee_id: z.string().uuid().optional(),
  status: z.enum(["archived", "cancelled", "draft"]).optional(),
});

export const bulkUpdateDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(bulkActionSchema)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireModuleAccess(supabase, userId, "documents", { action: "write" });

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const docId of data.document_ids) {
      try {
        const canView = await canViewDocumentContent(userId, docId);
        if (!canView) {
          results.push({ id: docId, ok: false, error: "Нет доступа" });
          continue;
        }

        if (data.action === "archive") {
          try {
            await applyDocumentStatusTransition(supabase, userId, docId, "archived");
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (message.includes("legal hold")) {
              results.push({ id: docId, ok: false, error: "Legal hold" });
              continue;
            }
            throw e;
          }
        } else if (data.action === "assign") {
          if (!data.assignee_id) throw new Error("assignee_id required");
          const { error } = await supabase
            .from("documents")
            .update({ assigned_to: data.assignee_id } as never)
            .eq("id", docId);
          if (error) throw new Error(error.message);
        } else if (data.action === "status") {
          if (!data.status) throw new Error("status required");
          await applyDocumentStatusTransition(supabase, userId, docId, data.status);
        }

        results.push({ id: docId, ok: true });
      } catch (e) {
        results.push({
          id: docId,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    return { processed: results.length, success: ok, failed: results.length - ok, results };
  });

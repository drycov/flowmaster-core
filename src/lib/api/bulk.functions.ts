import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applyDocumentStatusTransition } from "@/lib/documents/status-transition.server";
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
        const { data: canView } = await supabaseAdmin.rpc(
          "can_view_document_content" as never,
          {
            _doc_id: docId,
            _user: userId,
          } as never,
        );
        if (!canView) {
          results.push({ id: docId, ok: false, error: "Нет доступа" });
          continue;
        }

        if (data.action === "archive") {
          await requireModuleAccess(supabase, userId, "archive", { action: "write" });
          const { data: doc } = await supabase
            .from("documents")
            .select("legal_hold")
            .eq("id", docId)
            .single();
          if (doc?.legal_hold) {
            results.push({ id: docId, ok: false, error: "Legal hold" });
            continue;
          }
          const { error } = await supabase
            .from("documents")
            .update({ status: "archived" as never, archived_at: new Date().toISOString() } as never)
            .eq("id", docId);
          if (error) throw new Error(error.message);
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

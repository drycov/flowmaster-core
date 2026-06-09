import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "@/lib/access/rbac.server";

export async function assertCanViewDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<void> {
  const { data: canView, error } = await supabaseAdmin.rpc(
    "can_view_document" as never,
    { _doc_id: documentId, _user: userId } as never,
  );
  if (error) throw new Error(error.message);
  if (!canView) throw new Error("Нет доступа к документу");
}

export async function assertCanViewDocumentContent(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<void> {
  const { data: canView, error } = await supabaseAdmin.rpc(
    "can_view_document_content" as never,
    { _doc_id: documentId, _user: userId } as never,
  );
  if (error) throw new Error(error.message);
  if (!canView) throw new Error("Нет доступа к содержимому документа");
}

/** Author in editable status, or manage_documents. */
export async function assertCanEditDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<void> {
  const { data: doc, error: readErr } = await supabase
    .from("documents")
    .select("id, status, created_by")
    .eq("id", documentId)
    .single();
  if (readErr || !doc) throw new Error(readErr?.message ?? "Document not found");

  const editableStatuses = ["draft", "returned_for_revision"];
  const canManage = await (async () => {
    try {
      await requirePermission(supabase, userId, "manage_documents");
      return true;
    } catch {
      return false;
    }
  })();

  if (!canManage && (doc as { created_by: string }).created_by !== userId) {
    throw new Error("Нет права редактировать документ");
  }
  if (!canManage && !editableStatuses.includes((doc as { status: string }).status)) {
    throw new Error("Документ нельзя редактировать в текущем статусе");
  }
}

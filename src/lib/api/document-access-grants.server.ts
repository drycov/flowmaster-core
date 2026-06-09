import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/access/rbac.server";

/** Author, workflow manager, or manage_documents may review/list access grants. */
export async function assertCanManageDocumentAccessGrants(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<void> {
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("created_by")
    .eq("id", documentId)
    .maybeSingle();

  if (docErr) throw new Error(docErr.message);
  if (!doc) throw new Error("Документ не найден");

  if ((doc as { created_by: string }).created_by === userId) {
    return;
  }

  const { data: canManage, error: wfErr } = await supabase.rpc(
    "can_manage_document_workflow" as never,
    { _doc_id: documentId, _user: userId } as never,
  );
  if (wfErr) throw new Error(wfErr.message);
  if (canManage) return;

  await requirePermission(supabase, userId, "manage_documents");
}

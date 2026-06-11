import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "@/lib/access/rbac.server";

/** Mask sensitive fields when content access is denied. */
export function maskDocumentContent<T extends { body?: string | null; summary?: string | null }>(
  doc: T,
  canViewContent: boolean,
): T & { content_restricted: boolean } {
  if (canViewContent) {
    return { ...doc, content_restricted: false };
  }
  return { ...doc, body: null, summary: null, content_restricted: true };
}

export async function canViewDocument(userId: string, documentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "can_view_document" as never,
    { _doc_id: documentId, _user: userId } as never,
  );
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function canViewDocumentContent(
  userId: string,
  documentId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "can_view_document_content" as never,
    { _doc_id: documentId, _user: userId } as never,
  );
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function assertCanViewDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<void> {
  if (!(await canViewDocument(userId, documentId))) {
    throw new Error("Нет доступа к документу");
  }
}

export async function assertCanViewDocumentContent(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<void> {
  if (!(await canViewDocumentContent(userId, documentId))) {
    throw new Error("Нет доступа к содержимому документа");
  }
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

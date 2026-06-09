import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enforceModuleLicense,
  requireModuleAccess,
} from "@/lib/access/enforcement.server";

export const ALLOWED_DIRECT_STATUS = ["archived", "cancelled", "draft"] as const;
export type DirectDocumentStatus = (typeof ALLOWED_DIRECT_STATUS)[number];

type DocumentStatusRow = {
  id: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
  legal_hold: boolean | null;
};

export async function applyDocumentStatusTransition(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
  nextStatus: DirectDocumentStatus,
): Promise<void> {
  if (nextStatus === "archived") {
    await enforceModuleLicense(supabase, "archive", "write");
  } else {
    await requireModuleAccess(supabase, userId, "documents", { action: "write" });
  }

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, status, created_by, assigned_to, legal_hold")
    .eq("id", documentId)
    .single();

  if (docErr || !doc) {
    throw new Error(docErr?.message ?? "Document not found");
  }

  const row = doc as DocumentStatusRow;

  if (nextStatus === "archived" && row.legal_hold) {
    throw new Error("Документ на legal hold — архивация запрещена");
  }

  if (nextStatus === "archived") {
    await requireModuleAccess(supabase, userId, "archive", { action: "write" });
  } else if (nextStatus === "cancelled") {
    if (row.created_by !== userId) {
      const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin" as never, {
        _user_id: userId,
      } as never);
      if (adminErr) throw new Error(adminErr.message);
      if (!isAdmin) {
        throw new Error("Только автор или администратор может отменить документ");
      }
    }
  } else if (nextStatus === "draft") {
    const allowedFrom = ["returned_for_revision", "rejected", "draft"];
    const isParticipant = row.created_by === userId || row.assigned_to === userId;
    if (!isParticipant || !allowedFrom.includes(row.status)) {
      throw new Error("Нельзя вернуть документ в черновик");
    }
  }

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "archived") {
    patch.archived_at = new Date().toISOString();
  }

  const { error } = await supabase.from("documents").update(patch as never).eq("id", documentId);
  if (error) throw new Error(error.message);
}

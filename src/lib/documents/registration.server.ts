import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isSidecarSchemaMissing } from "@/lib/documents/schema-fallback.server";
import { updateDocumentRegistration } from "@/lib/documents/sidecars.server";

async function resolvePrefix(journalId?: string | null): Promise<string> {
  if (journalId) {
    const { data, error } = await supabaseAdmin.rpc(
      "resolve_document_reg_prefix" as never,
      { _journal_id: journalId } as never,
    );
    const prefix = data as string | null | undefined;
    if (!error && typeof prefix === "string" && prefix.trim()) {
      return prefix.trim();
    }
  }

  const { data: org } = await supabaseAdmin
    .from("organization")
    .select("reg_number_prefix")
    .limit(1)
    .maybeSingle();

  return (org as { reg_number_prefix?: string | null } | null)?.reg_number_prefix?.trim() || "DOC";
}

async function assignRegNumberOnDocuments(
  documentId: string,
  journalId?: string | null,
): Promise<string> {
  const { data: doc, error: docErr } = await supabaseAdmin
    .from("documents")
    .select("reg_number, registration_journal_id")
    .eq("id", documentId)
    .single();

  if (docErr) throw new Error(docErr.message);

  const row = doc as { reg_number?: string | null; registration_journal_id?: string | null };
  const existing = row.reg_number?.trim();
  if (existing) return existing;

  const effectiveJournalId = journalId ?? row.registration_journal_id ?? null;
  const prefix = await resolvePrefix(effectiveJournalId);

  const { data: regNumber, error: rpcErr } = await supabaseAdmin.rpc(
    "next_document_reg_number" as never,
    { _prefix: prefix } as never,
  );
  if (rpcErr || !regNumber) {
    throw new Error(rpcErr?.message ?? "Не удалось присвоить регистрационный номер документу");
  }

  const { error: updErr } = await supabaseAdmin
    .from("documents")
    .update({ reg_number: regNumber } as never)
    .eq("id", documentId);
  if (updErr) throw new Error(updErr.message);

  return String(regNumber);
}

export async function ensureDocumentRegNumber(
  documentId: string,
  journalId?: string | null,
): Promise<string> {
  const { data: regRow, error: readErr } = await supabaseAdmin
    .from("document_registration" as never)
    .select("reg_number, registration_journal_id")
    .eq("document_id" as never, documentId)
    .maybeSingle();

  if (readErr) {
    if (isSidecarSchemaMissing(readErr.message)) {
      return assignRegNumberOnDocuments(documentId, journalId);
    }
    throw new Error(readErr.message);
  }

  const row = regRow as { reg_number?: string | null; registration_journal_id?: string | null } | null;
  const existing = row?.reg_number?.trim();
  if (existing) return existing;

  const effectiveJournalId = journalId ?? row?.registration_journal_id ?? null;
  const prefix = await resolvePrefix(effectiveJournalId);

  const { data: regNumber, error: rpcErr } = await supabaseAdmin.rpc(
    "next_document_reg_number" as never,
    { _prefix: prefix } as never,
  );

  if (!rpcErr && regNumber) {
    try {
      await updateDocumentRegistration(supabaseAdmin, documentId, { reg_number: regNumber });
    } catch (err) {
      if (err instanceof Error && isSidecarSchemaMissing(err.message)) {
        const { error: updErr } = await supabaseAdmin
          .from("documents")
          .update({ reg_number: regNumber } as never)
          .eq("id", documentId);
        if (updErr) throw new Error(updErr.message);
        return String(regNumber);
      }
      throw err;
    }
    return String(regNumber);
  }

  const { data: retry, error: retryErr } = await supabaseAdmin
    .from("document_registration" as never)
    .select("reg_number")
    .eq("document_id" as never, documentId)
    .maybeSingle();

  if (retryErr) {
    if (isSidecarSchemaMissing(retryErr.message)) {
      return assignRegNumberOnDocuments(documentId, journalId);
    }
    throw new Error(retryErr.message);
  }

  const retried = (retry as { reg_number?: string | null } | null)?.reg_number?.trim();
  if (retried) return retried;

  throw new Error(rpcErr?.message ?? "Не удалось присвоить регистрационный номер документу");
}

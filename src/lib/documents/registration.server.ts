import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

export async function ensureDocumentRegNumber(
  documentId: string,
  journalId?: string | null,
): Promise<string> {
  const { data: regRow, error: readErr } = await supabaseAdmin
    .from("document_registration")
    .select("reg_number, registration_journal_id")
    .eq("document_id", documentId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);

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
    await updateDocumentRegistration(supabaseAdmin, documentId, { reg_number: regNumber });
    return String(regNumber);
  }

  const { data: retry, error: retryErr } = await supabaseAdmin
    .from("document_registration")
    .select("reg_number")
    .eq("document_id", documentId)
    .maybeSingle();

  if (retryErr) throw new Error(retryErr.message);

  const retried = (retry as { reg_number?: string | null } | null)?.reg_number?.trim();
  if (retried) return retried;

  throw new Error(rpcErr?.message ?? "Не удалось присвоить регистрационный номер документу");
}

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function ensureDocumentRegNumber(documentId: string): Promise<string> {
  const { data: doc, error: readErr } = await supabaseAdmin
    .from("documents")
    .select("reg_number")
    .eq("id", documentId)
    .single();

  if (readErr) throw new Error(readErr.message);

  const existing = (doc as { reg_number?: string | null }).reg_number?.trim();
  if (existing) return existing;

  const { data: org } = await supabaseAdmin
    .from("organization")
    .select("reg_number_prefix")
    .limit(1)
    .maybeSingle();

  const prefix =
    (org as { reg_number_prefix?: string | null } | null)?.reg_number_prefix?.trim() || "DOC";

  const { data: regNumber, error: rpcErr } = await supabaseAdmin.rpc(
    "next_document_reg_number" as never,
    { _prefix: prefix } as never,
  );

  if (!rpcErr && regNumber) {
    const { data: updated, error: updErr } = await (supabaseAdmin.from("documents") as any)
      .update({ reg_number: regNumber })
      .eq("id", documentId)
      .select("reg_number")
      .single();

    if (updErr) throw new Error(updErr.message);
    return (updated as { reg_number: string }).reg_number;
  }

  const { data: retry, error: retryErr } = await supabaseAdmin
    .from("documents")
    .select("reg_number")
    .eq("id", documentId)
    .single();

  if (retryErr) throw new Error(retryErr.message);

  const retried = (retry as { reg_number?: string | null }).reg_number?.trim();
  if (retried) return retried;

  throw new Error(
    rpcErr?.message ?? "Не удалось присвоить регистрационный номер документу",
  );
}

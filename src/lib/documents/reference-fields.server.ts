import type { SupabaseClient } from "@supabase/supabase-js";

export type DocumentReferenceInput = {
  document_type_id?: string | null;
  priority_id?: string | null;
  correspondent_id?: string | null;
  due_at?: string | null;
  doc_type?: string;
};

export type ResolvedDocumentReferences = {
  document_type_id: string | null;
  priority_id: string | null;
  correspondent_id: string | null;
  doc_type: string;
  due_at: string | null;
};

export const DEFAULT_DOC_TYPE_CODE = "general";

export async function resolveDocumentTypeByCode(
  supabase: SupabaseClient,
  code?: string | null,
  fallback = DEFAULT_DOC_TYPE_CODE,
): Promise<{ document_type_id: string | null; doc_type: string }> {
  const normalized = (code ?? fallback).trim();
  if (!normalized) {
    return { document_type_id: null, doc_type: fallback };
  }

  const { data } = await supabase
    .from("ref_document_types")
    .select("id, code")
    .eq("code", normalized)
    .maybeSingle();

  if (data?.id && data.code) {
    return { document_type_id: data.id, doc_type: data.code };
  }

  return { document_type_id: null, doc_type: normalized };
}

export async function resolveDocumentReferences(
  supabase: SupabaseClient,
  input: DocumentReferenceInput,
): Promise<ResolvedDocumentReferences> {
  const document_type_id = input.document_type_id ?? null;
  const priority_id = input.priority_id ?? null;
  const correspondent_id = input.correspondent_id ?? null;
  let doc_type = input.doc_type ?? DEFAULT_DOC_TYPE_CODE;
  let due_at = input.due_at ?? null;

  if (document_type_id) {
    const { data } = await supabase
      .from("ref_document_types")
      .select("code")
      .eq("id", document_type_id)
      .maybeSingle();
    if (data?.code) doc_type = data.code;
  }

  if (priority_id && !due_at) {
    const { data } = await supabase
      .from("ref_priorities")
      .select("sla_hours")
      .eq("id", priority_id)
      .maybeSingle();
    if (data?.sla_hours != null && data.sla_hours > 0) {
      due_at = new Date(Date.now() + data.sla_hours * 60 * 60 * 1000).toISOString();
    }
  }

  return {
    document_type_id,
    priority_id,
    correspondent_id,
    doc_type,
    due_at,
  };
}

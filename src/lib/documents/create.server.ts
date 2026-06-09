import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureDocumentRegNumber } from "@/lib/documents/registration.server";
import {
  resolveDocumentReferences,
  type DocumentReferenceInput,
} from "@/lib/documents/reference-fields.server";

export type InsertDocumentRowInput = DocumentReferenceInput & {
  title_ru: string;
  title_kk?: string | null;
  summary?: string | null;
  body?: string | null;
  template_id?: string | null;
  nomenclature_id?: string | null;
  registration_journal_id?: string | null;
  delivery_method_id?: string | null;
  access_level_id?: string | null;
  received_at?: string | null;
  sent_at?: string | null;
  pages_count?: number | null;
  copies_count?: number | null;
  external_reg_number?: string | null;
  workflow_id?: string | null;
  custom_route?: unknown;
  project_id?: string | null;
  assigned_to?: string | null;
  created_by: string;
};

export async function insertDocumentWithRegistration(
  input: InsertDocumentRowInput,
): Promise<{ id: string; reg_number: string }> {
  const refs = await resolveDocumentReferences(supabaseAdmin, {
    document_type_id: input.document_type_id,
    priority_id: input.priority_id,
    correspondent_id: input.correspondent_id,
    due_at: input.due_at,
    doc_type: input.doc_type,
  });

  const { data: row, error } = await supabaseAdmin
    .from("documents")
    .insert({
      title_ru: input.title_ru,
      title_kk: input.title_kk ?? null,
      summary: input.summary ?? null,
      body: input.body ?? null,
      doc_type: refs.doc_type,
      document_type_id: refs.document_type_id,
      priority_id: refs.priority_id,
      correspondent_id: refs.correspondent_id,
      registration_journal_id: input.registration_journal_id ?? null,
      delivery_method_id: input.delivery_method_id ?? null,
      access_level_id: input.access_level_id ?? null,
      received_at: input.received_at ?? null,
      sent_at: input.sent_at ?? null,
      pages_count: input.pages_count ?? null,
      copies_count: input.copies_count ?? null,
      external_reg_number: input.external_reg_number ?? null,
      nomenclature_id: input.nomenclature_id ?? null,
      template_id: input.template_id ?? null,
      assigned_to: input.assigned_to ?? null,
      due_at: refs.due_at,
      workflow_id: input.workflow_id ?? null,
      custom_route: input.custom_route ?? null,
      project_id: input.project_id ?? null,
      created_by: input.created_by,
      reg_number: "",
    } as never)
    .select("id, reg_number")
    .single();

  if (error) throw new Error(error.message);

  const regNumber = await ensureDocumentRegNumber(row.id, input.registration_journal_id ?? null);

  return { id: row.id, reg_number: regNumber };
}

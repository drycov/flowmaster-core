import type { SupabaseClient } from "@supabase/supabase-js";
import { isSidecarSchemaMissing } from "@/lib/documents/schema-fallback.server";

const ROOT_FIELDS = new Set([
  "title_ru",
  "title_kk",
  "summary",
  "body",
  "template_id",
  "department_id",
  "project_id",
  "status",
]);

const REGISTRATION_FIELDS = new Set([
  "reg_number",
  "registration_journal_id",
  "delivery_method_id",
  "received_at",
  "sent_at",
  "pages_count",
  "copies_count",
  "external_reg_number",
]);

const CLASSIFICATION_FIELDS = new Set([
  "doc_type",
  "document_type_id",
  "priority_id",
  "correspondent_id",
  "nomenclature_id",
  "access_level_id",
]);

const ARCHIVE_FIELDS = new Set([
  "archived_at",
  "archive_location_id",
  "retention_period_id",
  "retention_due_at",
  "legal_hold",
  "legal_hold_note",
  "legal_hold_at",
  "legal_hold_by",
]);

const LIFECYCLE_FIELDS = new Set([
  "due_at",
  "sla_status",
  "workflow_id",
  "custom_route",
  "assigned_to",
]);

function pickFields(
  patch: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (allowed.has(key) && value !== undefined) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function mergeRootFields(
  root: Record<string, unknown> | null,
  patch: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!patch) return root;
  return { ...(root ?? {}), ...patch };
}

async function upsertSidecar(
  client: SupabaseClient,
  table:
    | "document_registration"
    | "document_classification"
    | "document_archive"
    | "document_lifecycle",
  documentId: string,
  patch: Record<string, unknown>,
): Promise<"ok" | "missing"> {
  const { error } = await client
    .from(table)
    .upsert({ document_id: documentId, ...patch } as never, { onConflict: "document_id" });
  if (error) {
    if (isSidecarSchemaMissing(error.message)) return "missing";
    throw new Error(error.message);
  }
  return "ok";
}

/** Write domain fields to sidecar tables (canonical path). Root fields go to documents. */
export async function patchDocumentDomains(
  client: SupabaseClient,
  documentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  let root = pickFields(patch, ROOT_FIELDS);
  const registration = pickFields(patch, REGISTRATION_FIELDS);
  const classification = pickFields(patch, CLASSIFICATION_FIELDS);
  const archive = pickFields(patch, ARCHIVE_FIELDS);
  const lifecycle = pickFields(patch, LIFECYCLE_FIELDS);

  if (registration) {
    const result = await upsertSidecar(client, "document_registration", documentId, registration);
    if (result === "missing") {
      root = mergeRootFields(root, registration);
    }
  }
  if (classification) {
    const result = await upsertSidecar(client, "document_classification", documentId, classification);
    if (result === "missing") {
      root = mergeRootFields(root, classification);
    }
  }
  if (archive) {
    const result = await upsertSidecar(client, "document_archive", documentId, archive);
    if (result === "missing") {
      root = mergeRootFields(root, archive);
    }
  }
  if (lifecycle) {
    const result = await upsertSidecar(client, "document_lifecycle", documentId, lifecycle);
    if (result === "missing") {
      root = mergeRootFields(root, lifecycle);
    }
  }

  if (root) {
    const { error } = await client.from("documents").update(root as never).eq("id", documentId);
    if (error) throw new Error(error.message);
  }
}

export async function updateDocumentRegistration(
  client: SupabaseClient,
  documentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const registration = pickFields(patch, REGISTRATION_FIELDS);
  if (!registration) return;

  const result = await upsertSidecar(client, "document_registration", documentId, registration);
  if (result === "missing") {
    const { error } = await client
      .from("documents")
      .update(registration as never)
      .eq("id", documentId);
    if (error) throw new Error(error.message);
  }
}

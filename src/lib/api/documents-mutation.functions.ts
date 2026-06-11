import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireModuleAccess, requirePermission } from "./_helpers";
import { customRouteSchema } from "@/lib/workflow/custom-route-schema";
import { insertDocumentWithRegistration } from "@/lib/documents/create.server";
import { registerBodyContentVersion } from "@/lib/documents/versions.server";
import { resolveDocumentReferences } from "@/lib/documents/reference-fields.server";
import { assertCanEditDocument, assertCanViewDocument } from "@/lib/api/document-access.server";
import {
  ALLOWED_DIRECT_STATUS,
  applyDocumentStatusTransition,
} from "@/lib/documents/status-transition.server";
import { patchDocumentDomains } from "@/lib/documents/sidecars.server";

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      title_ru: z.string().min(1).max(500),
      title_kk: z.string().max(500).optional().nullable(),
      summary: z.string().max(2000).optional().nullable(),
      body: z.string().optional().nullable(),
      doc_type: z.string().max(64).optional(),
      document_type_id: z.string().uuid().nullable().optional(),
      priority_id: z.string().uuid().nullable().optional(),
      correspondent_id: z.string().uuid().nullable().optional(),
      registration_journal_id: z.string().uuid().nullable().optional(),
      delivery_method_id: z.string().uuid().nullable().optional(),
      access_level_id: z.string().uuid().nullable().optional(),
      received_at: z.string().nullable().optional(),
      sent_at: z.string().nullable().optional(),
      pages_count: z.number().int().min(0).nullable().optional(),
      copies_count: z.number().int().min(0).nullable().optional(),
      external_reg_number: z.string().max(128).nullable().optional(),
      nomenclature_id: z.string().uuid().nullable().optional(),
      template_id: z.string().uuid().nullable().optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      due_at: z.string().nullable().optional(),
      workflow_id: z.string().uuid().nullable().optional(),
      custom_route: customRouteSchema,
      project_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { userId } = context;
    const {
      title_ru,
      title_kk,
      summary,
      body,
      nomenclature_id,
      template_id,
      assigned_to,
      workflow_id,
      custom_route,
      document_type_id,
      priority_id,
      correspondent_id,
      registration_journal_id,
      delivery_method_id,
      access_level_id,
      received_at,
      sent_at,
      pages_count,
      copies_count,
      external_reg_number,
      due_at,
      doc_type,
      project_id,
    } = data;

    return insertDocumentWithRegistration({
      title_ru,
      title_kk,
      summary,
      body,
      document_type_id,
      priority_id,
      correspondent_id,
      registration_journal_id,
      delivery_method_id,
      access_level_id,
      received_at,
      sent_at,
      pages_count,
      copies_count,
      external_reg_number,
      nomenclature_id,
      template_id,
      assigned_to,
      due_at,
      doc_type,
      workflow_id,
      custom_route,
      project_id,
      created_by: userId,
    });
  });

export const updateDocumentMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      title_ru: z.string().min(1).max(500).optional(),
      title_kk: z.string().max(500).nullable().optional(),
      summary: z.string().max(2000).nullable().optional(),
      body: z.string().nullable().optional(),
      document_type_id: z.string().uuid().nullable().optional(),
      priority_id: z.string().uuid().nullable().optional(),
      correspondent_id: z.string().uuid().nullable().optional(),
      registration_journal_id: z.string().uuid().nullable().optional(),
      delivery_method_id: z.string().uuid().nullable().optional(),
      access_level_id: z.string().uuid().nullable().optional(),
      nomenclature_id: z.string().uuid().nullable().optional(),
      due_at: z.string().nullable().optional(),
      received_at: z.string().nullable().optional(),
      sent_at: z.string().nullable().optional(),
      pages_count: z.number().int().min(0).nullable().optional(),
      copies_count: z.number().int().min(0).nullable().optional(),
      external_reg_number: z.string().max(128).nullable().optional(),
      legal_hold: z.boolean().optional(),
      legal_hold_note: z.string().max(500).nullable().optional(),
      retention_period_id: z.string().uuid().nullable().optional(),
      archive_location_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;
    const { id, ...patchIn } = data;

    await assertCanEditDocument(supabase, userId, id);

    const refs = await resolveDocumentReferences(supabaseAdmin, {
      document_type_id: patchIn.document_type_id,
      priority_id: patchIn.priority_id,
      correspondent_id: patchIn.correspondent_id,
      due_at: patchIn.due_at,
    });

    if (patchIn.legal_hold !== undefined) {
      const canArchive = await (async () => {
        try {
          await requireModuleAccess(supabase, userId, "archive", { action: "write" });
          return true;
        } catch {
          try {
            await requirePermission(supabase, userId, "manage_documents");
            return true;
          } catch {
            return false;
          }
        }
      })();
      if (!canArchive) throw new Error("Нет права управлять legal hold");
    }

    const patch: Record<string, unknown> = { ...patchIn };
    if (patchIn.legal_hold === true) {
      patch.legal_hold_at = new Date().toISOString();
      patch.legal_hold_by = userId;
    }
    if (patchIn.document_type_id !== undefined) patch.doc_type = refs.doc_type;
    if (patchIn.document_type_id !== undefined) patch.document_type_id = refs.document_type_id;
    if (patchIn.priority_id !== undefined) patch.priority_id = refs.priority_id;
    if (patchIn.correspondent_id !== undefined) patch.correspondent_id = refs.correspondent_id;
    if (patchIn.due_at !== undefined) patch.due_at = refs.due_at;

    await patchDocumentDomains(supabaseAdmin, id, patch);

    if (patchIn.body !== undefined) {
      await registerBodyContentVersion(supabase, {
        documentId: id,
        userId,
        body: patchIn.body ?? "",
      });
    }

    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid(), body: z.string().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;
    await assertCanViewDocument(supabase, userId, data.document_id);
    const { error } = await supabase
      .from("document_comments")
      .insert({ document_id: data.document_id, body: data.body, author_id: userId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDocumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(ALLOWED_DIRECT_STATUS),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await applyDocumentStatusTransition(supabase, userId, data.id, data.status);
    return { ok: true };
  });

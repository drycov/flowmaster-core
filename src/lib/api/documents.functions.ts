import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceModuleLicense, requireModuleAccess, requirePermission } from "./_helpers";
import { customRouteSchema } from "@/lib/workflow/custom-route-schema";
import { insertDocumentWithRegistration } from "@/lib/documents/create.server";
import { registerBodyContentVersion } from "@/lib/documents/versions.server";
import { resolveDocumentReferences } from "@/lib/documents/reference-fields.server";
import { runSignatureVerification } from "@/lib/api/signatures.functions";
import { assertCanManageDocumentAccessGrants } from "@/lib/api/document-access-grants.server";
import {
  ALLOWED_DIRECT_STATUS,
  applyDocumentStatusTransition,
} from "@/lib/documents/status-transition.server";

const DOCUMENT_SELECT = `
  id, reg_number, doc_type, status, title_ru, title_kk, summary, body,
  nomenclature_id, template_id, current_version, created_by, assigned_to,
  department_id, due_at, sla_status, archived_at, legal_hold, legal_hold_note, legal_hold_at,
  retention_period_id, retention_due_at,
  created_at, updated_at, workflow_id, custom_route,
  document_type_id, priority_id, correspondent_id,
  registration_journal_id, delivery_method_id, access_level_id, archive_location_id,
  ref_archive_locations!documents_archive_location_id_fkey(id, code, name_ru, name_kk),
  ref_retention_periods!documents_retention_period_id_fkey(id, code, name_ru, name_kk, years, is_permanent),
  nomenclature_items!documents_nomenclature_id_fkey(id, code, title_ru, title_kk, retention_years),
  received_at, sent_at, pages_count, copies_count, external_reg_number,
  ref_document_types!documents_document_type_id_fkey(id, code, name_ru, name_kk),
  ref_priorities!documents_priority_id_fkey(id, code, name_ru, name_kk, color, sla_hours),
  ref_correspondents!documents_correspondent_id_fkey(id, code, name_ru, name_kk, bin),
  ref_registration_journals!documents_registration_journal_id_fkey(id, code, name_ru, name_kk, prefix),
  ref_delivery_methods!documents_delivery_method_id_fkey(id, code, name_ru, name_kk),
  ref_access_levels!documents_access_level_id_fkey(id, code, name_ru, name_kk, level_order),
  workflows!documents_workflow_id_fkey(name_ru, name_kk, definition),
  project_id,
  document_projects!documents_project_id_fkey(id, code, name_ru, name_kk)
`;

const CONTENT_MASK = "[Гриф доступа: содержимое скрыто]";

// ============== LIST ==============
export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        status: z.string().nullable().optional(),
        search: z.string().nullable().optional(),
        scope: z.enum(["all", "mine", "assigned", "archive"]).optional(),
        document_type_code: z.string().nullable().optional(),
        legal_hold_only: z.boolean().optional(),
        retention_expiring: z.boolean().optional(),
        limit: z.number().min(1).max(200).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data?.scope === "archive") {
      await enforceModuleLicense(supabase, "archive", "read");
    }

    if (data?.search && data.search.trim().length >= 2) {
      const { data: rows, error } = await supabase.rpc("search_documents_fts" as never, {
        _query: data.search.trim(),
        _status: data?.status ?? null,
        _document_type_code: data?.document_type_code ?? null,
        _scope_user: userId,
        _scope: data?.scope ?? "all",
        _limit: data?.limit ?? 100,
      } as never);
      if (error) throw new Error(error.message);
      return rows ?? [];
    }

    let q = supabase
      .from("documents")
      .select(
        "id, reg_number, title_ru, title_kk, status, doc_type, sla_status, due_at, created_at, created_by, assigned_to, current_version, received_at, sent_at, external_reg_number, legal_hold, retention_due_at, archived_at, ref_document_types!documents_document_type_id_fkey(code)",
      )
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.status) q = q.eq("status", data.status as never);
    if (data?.scope === "mine") q = q.eq("created_by", userId);
    if (data?.scope === "assigned") q = q.eq("assigned_to", userId);
    if (data?.scope === "archive") q = q.eq("status", "archived" as never);
    if (data?.legal_hold_only) q = q.eq("legal_hold", true);
    if (data?.retention_expiring) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      q = q
        .eq("legal_hold", false)
        .not("retention_due_at", "is", null)
        .lte("retention_due_at", horizon.toISOString())
        .in("status", ["approved", "signed", "in_review"]);
    }
    if (data?.document_type_code) {
      const { data: dt } = await supabase
        .from("ref_document_types")
        .select("id")
        .eq("code", data.document_type_code)
        .maybeSingle();
      if (dt?.id) {
        q = q.eq("document_type_id", dt.id);
      } else {
        q = q.eq("doc_type", data.document_type_code);
      }
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============== GET ==============
export const getDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [doc, versions, sigs, comments, runs, events, tasks, contract, parties] = await Promise.all([
      supabase
        .from("documents")
        .select(DOCUMENT_SELECT)
        .eq("id", data.id)
        .single(),
      supabase
        .from("document_versions")
        .select("*")
        .eq("document_id", data.id)
        .order("version_no", { ascending: false }),
      supabase
        .from("document_signatures")
        .select("*")
        .eq("document_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("document_comments")
        .select("*")
        .eq("document_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("workflow_runs")
        .select("*, workflows(name_ru, name_kk, definition)")
        .eq("document_id", data.id)
        .order("started_at", { ascending: false }),
      supabase
        .from("workflow_events")
        .select("*")
        .eq("document_id", data.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("workflow_tasks")
        .select("*")
        .eq("document_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contract_details")
        .select("*, ref_correspondents!contract_details_counterparty_id_fkey(id, code, name_ru, name_kk, bin)")
        .eq("document_id", data.id)
        .maybeSingle(),
      supabase
        .from("document_correspondents")
        .select("id, role, is_primary, ref_correspondents(id, code, name_ru, name_kk, bin)")
        .eq("document_id", data.id),
    ]);
    if (doc.error) throw new Error(doc.error.message);

    const { data: canViewContent } = await supabase.rpc(
      "can_view_document_content" as never,
      { _doc_id: data.id, _user: context.userId } as never,
    );

    const document = { ...doc.data } as Record<string, unknown>;
    if (!canViewContent) {
      document.body = CONTENT_MASK;
      document.summary = CONTENT_MASK;
      document.content_restricted = true;
    } else {
      document.content_restricted = false;
    }

    let can_manage_access_grants = false;
    try {
      await assertCanManageDocumentAccessGrants(supabase, context.userId, data.id);
      can_manage_access_grants = true;
    } catch {
      can_manage_access_grants = false;
    }

    return {
      document,
      versions: canViewContent ? (versions.data ?? []) : [],
      signatures: canViewContent ? (sigs.data ?? []) : [],
      comments: canViewContent ? (comments.data ?? []) : [],
      runs: runs.data ?? [],
      events: events.data ?? [],
      tasks: tasks.data ?? [],
      contract_details: contract.data ?? null,
      document_correspondents: parties.data ?? [],
      content_restricted: !canViewContent,
      can_manage_access_grants,
    };
  });


// ============== CREATE ==============
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

// ============== UPDATE METADATA ==============
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

    const { data: doc, error: readErr } = await supabase
      .from("documents")
      .select("id, status, created_by")
      .eq("id", id)
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

    if (!canManage && doc.created_by !== userId) {
      throw new Error("Нет права редактировать документ");
    }
    if (!canManage && !editableStatuses.includes(doc.status)) {
      throw new Error("Документ нельзя редактировать в текущем статусе");
    }

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

    const { error } = await supabase.from("documents").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);

    if (patchIn.body !== undefined) {
      await registerBodyContentVersion(supabase, {
        documentId: id,
        userId,
        body: patchIn.body ?? "",
      });
    }

    return { ok: true };
  });

// ============== ADD COMMENT ==============
export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid(), body: z.string().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("document_comments")
      .insert({ document_id: data.document_id, body: data.body, author_id: userId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== ADD SIGNATURE (NCALayer payload) ==============
export const addSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      version_id: z.string().uuid().optional().nullable(),
      payload: z.string().min(1),
      cert_subject: z.string().optional().nullable(),
      cert_serial: z.string().optional().nullable(),
      cert_issuer: z.string().optional().nullable(),
      signature_type: z.string().default("CMS"),
      workflow_task_id: z.string().uuid().optional().nullable(),
      signer_iin: z.string().optional().nullable(),
      signer_bin: z.string().optional().nullable(),
      cert_valid_from: z.string().optional().nullable(),
      cert_valid_to: z.string().optional().nullable(),
      cert_fingerprint: z.string().optional().nullable(),
      content_hash: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "eds_signing", "write");
    const { supabase, userId } = context;
    const { workflow_task_id, ...signatureData } = data;

    const [{ data: profile }, { data: org }, { data: isAdmin }] = await Promise.all([
      supabase.from("profiles").select("iin").eq("id", userId).maybeSingle(),
      supabase.from("organization").select("settings").limit(1).maybeSingle(),
      supabase.rpc("is_admin" as never, { _user_id: userId } as never),
    ]);

    const edsPolicy = (org?.settings as { eds?: Record<string, boolean> } | null)?.eds ?? {};
    const requireIinMatch = edsPolicy.require_iin_match !== false;
    const requireCertValid = edsPolicy.require_cert_valid !== false;
    const allowOrgCert = edsPolicy.allow_org_certificate !== false;

    if (requireCertValid && data.cert_valid_to) {
      const validTo = new Date(data.cert_valid_to);
      if (!Number.isNaN(validTo.getTime()) && validTo < new Date()) {
        throw new Error("Срок действия сертификата истёк");
      }
    }

    if (requireIinMatch && !isAdmin) {
      const profileIin = profile?.iin?.trim();
      const signerIin = data.signer_iin?.trim();
      if (profileIin && signerIin && profileIin !== signerIin) {
        throw new Error("ИИН сертификата не совпадает с профилем пользователя");
      }
      if (profileIin && !signerIin && !data.signer_bin) {
        throw new Error("В сертификате не найден ИИН");
      }
      if (!allowOrgCert && data.signer_bin && !signerIin) {
        throw new Error("Подписание сертификатом организации запрещено политикой");
      }
    }

    let signTaskId = workflow_task_id ?? null;
    let signTaskNodeId: string | null = null;
    let signTaskRunId: string | null = null;
    if (signTaskId) {
      const { data: task, error: taskErr } = await supabase
        .from("workflow_tasks")
        .select("id, document_id, assignee_id, status, action_required, node_type, node_id, run_id")
        .eq("id", signTaskId)
        .single();
      if (taskErr || !task) throw new Error("Задача подписания не найдена");
      if (task.document_id !== data.document_id) throw new Error("Задача не относится к документу");
      if (task.assignee_id !== userId) throw new Error("Нет права подписать этот документ");
      if (task.status !== "pending") throw new Error("Задача подписания уже завершена");
      const isSign =
        task.action_required?.toLowerCase() === "sign" ||
        task.node_type?.toUpperCase() === "SIGNATURE";
      if (!isSign) throw new Error("Задача не является этапом подписания");
      signTaskNodeId = task.node_id ?? null;
      signTaskRunId = task.run_id ?? null;
    } else {
      const { data: pendingTask, error: pendingErr } = await supabase
        .from("workflow_tasks")
        .select("id, node_id, run_id")
        .eq("document_id", data.document_id)
        .eq("assignee_id", userId)
        .eq("status", "pending")
        .or("action_required.eq.sign,node_type.eq.SIGNATURE")
        .limit(1)
        .maybeSingle();
      if (pendingErr) throw new Error(pendingErr.message);
      if (!pendingTask) throw new Error("Нет активной задачи подписания для этого документа");
      signTaskId = pendingTask.id;
      signTaskNodeId = pendingTask.node_id ?? null;
      signTaskRunId = pendingTask.run_id ?? null;
    }

    if (signTaskRunId && signTaskNodeId) {
      const { data: run } = await supabase
        .from("workflow_runs")
        .select("context, workflows(definition)")
        .eq("id", signTaskRunId)
        .maybeSingle();
      const ctx = run?.context as { nodes?: Array<{ id: string; data?: { config?: { signature_provider?: string } } }> } | null;
      const wfDef = (run?.workflows as { definition?: { nodes?: typeof ctx.nodes } } | null)?.definition;
      const nodes = ctx?.nodes ?? wfDef?.nodes ?? [];
      const node = nodes.find((n) => n.id === signTaskNodeId);
      const provider = node?.data?.config?.signature_provider ?? "ncalayer";
      if (provider === "ncalayer" && data.signature_type !== "CMS") {
        throw new Error("Для этого этапа требуется подпись через NCALayer (CMS)");
      }
    }

    const signedAt = new Date().toISOString();
    const { data: docRow } = await supabase
      .from("documents")
      .select("id, body")
      .eq("id", data.document_id)
      .single();

    const verification = docRow
      ? await runSignatureVerification(
          {
            id: "pending",
            document_id: data.document_id,
            signer_id: userId,
            payload: data.payload,
            signed_at: signedAt,
            signer_iin: data.signer_iin ?? null,
            content_hash: data.content_hash ?? null,
            cert_valid_from: data.cert_valid_from ?? null,
            cert_valid_to: data.cert_valid_to ?? null,
          },
          docRow,
          profile?.iin,
        )
      : null;

    const { error } = await supabase.from("document_signatures").insert({
      ...signatureData,
      signer_id: userId,
      status: "signed",
      signed_at: signedAt,
      verification_status: verification?.status ?? "unverified",
      verified_at: verification?.verified_at ?? null,
      verification_details: verification?.details ?? {},
    } as never);
    if (error) throw new Error(error.message);

    if (signTaskId) {
      const { error: wfError } = await supabase.rpc("app_advance_workflow_task" as never, {
        _task_id: signTaskId,
        _decision: "approve",
        _comment: null,
      } as never);
      if (wfError) throw new Error(wfError.message);
    }

    return { ok: true };
  });

// ============== UPDATE STATUS ==============
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

// ============== DASHBOARD STATS ==============
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [tasks, myDocs, allDocs, notifications] = await Promise.all([
      supabase
        .from("workflow_tasks")
        .select("id, status, due_at, title, document_id, created_at", { count: "exact" })
        .eq("assignee_id", userId)
        .eq("status", "pending")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(10),
      supabase
        .from("documents")
        .select("id, reg_number, title_ru, title_kk, status, sla_status, created_at", { count: "exact" })
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("documents").select("status, sla_status", { count: "exact", head: false }),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null),
    ]);
    const byStatus: Record<string, number> = {};
    let overdue = 0;
    (allDocs.data ?? []).forEach((d) => {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      if (d.sla_status === "overdue") overdue += 1;
    });
    return {
      tasks: tasks.data ?? [],
      tasksCount: tasks.count ?? 0,
      myDocs: myDocs.data ?? [],
      totalDocs: allDocs.count ?? 0,
      byStatus,
      overdue,
      unread: notifications.count ?? 0,
    };
  });

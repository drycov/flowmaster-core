import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceLicense, requirePermission } from "./_helpers";
import { customRouteSchema } from "@/lib/workflow/custom-route-schema";
import { ensureDocumentRegNumber } from "@/lib/documents/registration.server";
import { resolveDocumentReferences } from "@/lib/documents/reference-fields.server";

const DOCUMENT_SELECT = `
  id, reg_number, doc_type, status, title_ru, title_kk, summary, body,
  nomenclature_id, template_id, current_version, created_by, assigned_to,
  department_id, due_at, sla_status, archived_at, legal_hold,
  created_at, updated_at, workflow_id, custom_route,
  document_type_id, priority_id, correspondent_id,
  registration_journal_id, delivery_method_id, access_level_id, archive_location_id,
  received_at, sent_at, pages_count, copies_count, external_reg_number,
  ref_document_types!documents_document_type_id_fkey(id, code, name_ru, name_kk),
  ref_priorities!documents_priority_id_fkey(id, code, name_ru, name_kk, color, sla_hours),
  ref_correspondents!documents_correspondent_id_fkey(id, code, name_ru, name_kk, bin),
  ref_registration_journals!documents_registration_journal_id_fkey(id, code, name_ru, name_kk, prefix),
  ref_delivery_methods!documents_delivery_method_id_fkey(id, code, name_ru, name_kk),
  workflows!documents_workflow_id_fkey(name_ru, name_kk, definition)
`;

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
        limit: z.number().min(1).max(200).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data?.scope === "archive") {
      await enforceLicense(supabase, { featureRead: "archive" });
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
        "id, reg_number, title_ru, title_kk, status, doc_type, sla_status, due_at, created_at, created_by, assigned_to, current_version, received_at, sent_at, external_reg_number, ref_document_types!documents_document_type_id_fkey(code)",
      )
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.status) q = q.eq("status", data.status as never);
    if (data?.scope === "mine") q = q.eq("created_by", userId);
    if (data?.scope === "assigned") q = q.eq("assigned_to", userId);
    if (data?.scope === "archive") q = q.eq("status", "archived" as never);
    if (data?.document_type_code) {
      q = q.eq("ref_document_types.code", data.document_type_code);
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
    const [doc, versions, sigs, comments, runs, events, tasks] = await Promise.all([
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
    ]);
    if (doc.error) throw new Error(doc.error.message);
    return {
      document: doc.data,
      versions: versions.data ?? [],
      signatures: sigs.data ?? [],
      comments: comments.data ?? [],
      runs: runs.data ?? [],
      events: events.data ?? [],
      tasks: tasks.data ?? [],
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
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceLicense(context.supabase, { writable: true });
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
      received_at,
      sent_at,
      pages_count,
      copies_count,
      external_reg_number,
      due_at,
      doc_type,
    } = data;

    const refs = await resolveDocumentReferences(supabaseAdmin, {
      document_type_id,
      priority_id,
      correspondent_id,
      due_at,
      doc_type,
    });

    const { data: row, error } = await (supabaseAdmin.from("documents") as any)
      .insert({
        title_ru,
        title_kk,
        summary,
        body,
        doc_type: refs.doc_type,
        document_type_id: refs.document_type_id,
        priority_id: refs.priority_id,
        correspondent_id: refs.correspondent_id,
        nomenclature_id,
        template_id,
        assigned_to,
        due_at: refs.due_at,
        workflow_id,
        custom_route,
        created_by: userId,
        reg_number: "",
      })
      .select("id, reg_number")
      .single();
    if (error) throw new Error(error.message);

    const regNumber = await ensureDocumentRegNumber(row.id);
    return { ...row, reg_number: regNumber };
  });

// ============== ADD COMMENT ==============
export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid(), body: z.string().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
    await enforceLicense(context.supabase, { writable: true });
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
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceLicense(context.supabase, { writable: true, feature: "eds_signing" });
    const { supabase, userId } = context;
    const { workflow_task_id, ...signatureData } = data;

    let signTaskId = workflow_task_id ?? null;
    if (signTaskId) {
      const { data: task, error: taskErr } = await supabase
        .from("workflow_tasks")
        .select("id, document_id, assignee_id, status, action_required, node_type")
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
    } else {
      const { data: pendingTask, error: pendingErr } = await supabase
        .from("workflow_tasks")
        .select("id")
        .eq("document_id", data.document_id)
        .eq("assignee_id", userId)
        .eq("status", "pending")
        .or("action_required.eq.sign,node_type.eq.SIGNATURE")
        .limit(1)
        .maybeSingle();
      if (pendingErr) throw new Error(pendingErr.message);
      if (!pendingTask) throw new Error("Нет активной задачи подписания для этого документа");
      signTaskId = pendingTask.id;
    }

    const { error } = await supabase.from("document_signatures").insert({
      ...signatureData,
      signer_id: userId,
      status: "signed",
      signed_at: new Date().toISOString(),
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

const ALLOWED_DIRECT_STATUS = ["archived", "cancelled", "draft"] as const;
type DirectDocumentStatus = (typeof ALLOWED_DIRECT_STATUS)[number];

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
    const nextStatus = data.status as DirectDocumentStatus;
    await enforceLicense(supabase, {
      writable: true,
      ...(nextStatus === "archived" ? { feature: "archive" as const } : {}),
    });

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, status, created_by, assigned_to")
      .eq("id", data.id)
      .single();
    if (docErr || !doc) throw new Error(docErr?.message ?? "Document not found");

    if (nextStatus === "archived") {
      await requirePermission(supabase, userId, "archive_documents");
    } else if (nextStatus === "cancelled") {
      if (doc.created_by !== userId) {
        const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin" as never, {
          _user_id: userId,
        } as never);
        if (adminErr) throw new Error(adminErr.message);
        if (!isAdmin) throw new Error("Только автор или администратор может отменить документ");
      }
    } else if (nextStatus === "draft") {
      const allowedFrom = ["returned_for_revision", "rejected", "draft"];
      const isParticipant =
        doc.created_by === userId || doc.assigned_to === userId;
      if (!isParticipant || !allowedFrom.includes(doc.status)) {
        throw new Error("Нельзя вернуть документ в черновик");
      }
    }

    const patch: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "archived") patch.archived_at = new Date().toISOString();
    const { error } = await supabase.from("documents").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
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
      tasksCount: tasks.count ?? 
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============== LIST ==============
export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        status: z.string().nullable().optional(),
        search: z.string().nullable().optional(),
        scope: z.enum(["all", "mine", "assigned", "archive"]).optional(),
        limit: z.number().min(1).max(200).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("documents")
      .select(
        "id, reg_number, title_ru, title_kk, status, doc_type, sla_status, due_at, created_at, created_by, assigned_to, current_version",
      )
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.status) q = q.eq("status", data.status as never);
    if (data?.scope === "mine") q = q.eq("created_by", userId);
    if (data?.scope === "assigned") q = q.eq("assigned_to", userId);
    if (data?.scope === "archive") q = q.eq("status", "archived" as never);
    if (data?.search) {
      const s = data.search.replace(/[%_]/g, " ");
      q = q.or(`title_ru.ilike.%${s}%,title_kk.ilike.%${s}%,reg_number.ilike.%${s}%`);
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
    const [doc, versions, sigs, comments, runs, events] = await Promise.all([
      supabase
        .from("documents")
        .select(
          "id, reg_number, doc_type, status, title_ru, title_kk, summary, body, nomenclature_id, template_id, current_version, created_by, assigned_to, department_id, due_at, sla_status, archived_at, legal_hold, created_at, updated_at",
        )
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
    ]);
    if (doc.error) throw new Error(doc.error.message);
    return {
      document: doc.data,
      versions: versions.data ?? [],
      signatures: sigs.data ?? [],
      comments: comments.data ?? [],
      runs: runs.data ?? [],
      events: events.data ?? [],
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
      doc_type: z.string().max(64).default("general"),
      nomenclature_id: z.string().uuid().nullable().optional(),
      template_id: z.string().uuid().nullable().optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      due_at: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("documents")
      .insert({
        ...data,
        reg_number: "",
        created_by: userId,
      } as never)
      .select("id, reg_number")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============== ADD COMMENT ==============
export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid(), body: z.string().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
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
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("document_signatures").insert({
      ...data,
      signer_id: userId,
      status: "signed",
      signed_at: new Date().toISOString(),
    } as never);
    if (error) throw new Error(error.message);
    await supabase.from("documents").update({ status: "signed" as never }).eq("id", data.document_id);
    return { ok: true };
  });

// ============== UPDATE STATUS ==============
export const updateDocumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "in_review", "approved", "signed", "rejected", "archived", "cancelled"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "archived") patch.archived_at = new Date().toISOString();
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
      tasksCount: tasks.count ?? 0,
      myDocs: myDocs.data ?? [],
      totalDocs: allDocs.count ?? 0,
      byStatus,
      overdue,
      unread: notifications.count ?? 0,
    };
  });

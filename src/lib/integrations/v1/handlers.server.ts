import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { insertDocumentWithRegistration } from "@/lib/documents/create.server";
import { registerBodyContentVersion } from "@/lib/documents/versions.server";
import {
  applyDocumentStatusTransition,
  type DirectDocumentStatus,
} from "@/lib/documents/status-transition.server";
import {
  canViewDocument,
  canViewDocumentContent,
  maskDocumentContent,
} from "@/lib/api/document-access.server";
import { resolveDocumentTypeByCode } from "@/lib/documents/reference-fields.server";
import {
  enrichDocumentListRows,
  fetchDocumentSummaryById,
  type DocumentListRow,
} from "@/lib/documents/documents-read.server";
import { DOCUMENT_FULL_LIST_SELECT } from "@/lib/api/documents.shared.server";
import type { ApiKeyContext } from "@/lib/integrations/api-key-auth.server";

export async function v1ListDocuments(
  ctx: ApiKeyContext,
  params: { status?: string; limit?: number; offset?: number },
) {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabaseAdmin
    .from("documents_full" as never)
    .select(DOCUMENT_FULL_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) q = q.eq("status" as never, params.status as never);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const visible: DocumentListRow[] = [];
  for (const row of (data ?? []) as DocumentListRow[]) {
    if (await canViewDocument(ctx.userId, row.id)) visible.push(row);
  }

  const enriched = await enrichDocumentListRows(supabaseAdmin, visible);

  return { data: enriched, total: count ?? enriched.length, limit, offset };
}

export async function v1GetDocument(ctx: ApiKeyContext, documentId: string) {
  if (!(await canViewDocument(ctx.userId, documentId))) return null;

  const data = await fetchDocumentSummaryById(supabaseAdmin, documentId);
  if (!data) return null;

  const canContent = await canViewDocumentContent(ctx.userId, documentId);
  const masked = maskDocumentContent(
    {
      body: (data.body as string | null | undefined) ?? null,
      summary: (data.summary as string | null | undefined) ?? null,
    },
    canContent,
  );
  return { ...data, ...masked };
}

export async function v1CreateDocument(
  ctx: ApiKeyContext,
  input: {
    title_ru: string;
    title_kk?: string | null;
    summary?: string | null;
    body?: string | null;
    document_type_code?: string;
    external_reg_number?: string | null;
    received_at?: string | null;
  },
) {
  const { document_type_id, doc_type } = await resolveDocumentTypeByCode(
    supabaseAdmin,
    input.document_type_code,
    "internal",
  );

  const row = await insertDocumentWithRegistration({
    title_ru: input.title_ru,
    title_kk: input.title_kk ?? input.title_ru,
    summary: input.summary ?? null,
    body: input.body ?? null,
    doc_type,
    document_type_id,
    external_reg_number: input.external_reg_number ?? null,
    received_at: input.received_at ?? null,
    created_by: ctx.userId,
  });

  return {
    id: row.id,
    reg_number: row.reg_number,
    status: "draft",
    title_ru: input.title_ru,
  };
}

export async function v1UpdateDocumentStatus(
  ctx: ApiKeyContext,
  documentId: string,
  status: string,
) {
  const allowed: DirectDocumentStatus[] = ["archived", "cancelled", "draft"];
  if (!allowed.includes(status as DirectDocumentStatus)) {
    throw new Error(`Status must be one of: ${allowed.join(", ")}`);
  }

  if (!(await canViewDocumentContent(ctx.userId, documentId))) return null;

  await applyDocumentStatusTransition(
    supabaseAdmin,
    ctx.userId,
    documentId,
    status as DirectDocumentStatus,
  );

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, reg_number, status")
    .eq("id", documentId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function v1ListTasks(ctx: ApiKeyContext, params: { status?: string; limit?: number }) {
  const limit = Math.min(params.limit ?? 100, 200);

  let q = supabaseAdmin
    .from("workflow_tasks")
    .select(
      "id, document_id, run_id, title, node_type, status, assignee_id, action_required, due_at, completed_at, documents(id, reg_number, title_ru, status)",
    )
    .eq("assignee_id", ctx.userId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (params.status) {
    q = q.eq("status", params.status as never);
  } else {
    q = q.in("status", ["pending", "in_progress"]);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

type ImportItem = {
  title_ru: string;
  title_kk?: string | null;
  summary?: string | null;
  body?: string | null;
  external_reg_number?: string | null;
  correspondent_code?: string | null;
  received_at?: string | null;
};

export async function v1ImportIncoming(ctx: ApiKeyContext, items: ImportItem[], apiKeyId?: string) {
  const { data: job, error: jobErr } = await supabaseAdmin
    .from("import_jobs")
    .insert({
      kind: "incoming",
      status: "processing",
      source: "api",
      total_count: items.length,
      created_by: ctx.userId,
      api_key_id: apiKeyId ?? null,
      started_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (jobErr) throw new Error(jobErr.message);

  const errors: Array<{ index: number; message: string }> = [];
  let success = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      let correspondentId: string | null = null;
      if (item.correspondent_code) {
        const { data: corr } = await supabaseAdmin
          .from("ref_correspondents")
          .select("id")
          .eq("code", item.correspondent_code)
          .maybeSingle();
        correspondentId = corr?.id ?? null;
      }

      const { document_type_id } = await resolveDocumentTypeByCode(
        supabaseAdmin,
        "incoming",
        "incoming",
      );

      await insertDocumentWithRegistration({
        title_ru: item.title_ru,
        title_kk: item.title_kk ?? item.title_ru,
        summary: item.summary ?? null,
        body: item.body ?? null,
        doc_type: "incoming",
        document_type_id,
        correspondent_id: correspondentId,
        external_reg_number: item.external_reg_number ?? null,
        received_at: item.received_at ?? new Date().toISOString(),
        created_by: ctx.userId,
      });
      success++;
    } catch (e) {
      errors.push({
        index: i,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const finalStatus = errors.length === items.length ? "failed" : "completed";
  await supabaseAdmin
    .from("import_jobs")
    .update({
      status: finalStatus,
      success_count: success,
      error_count: errors.length,
      errors,
      completed_at: new Date().toISOString(),
    } as never)
    .eq("id", job.id);

  return {
    job_id: job.id,
    status: finalStatus,
    total: items.length,
    success,
    errors,
  };
}

export async function v1UpdateDocument(
  ctx: ApiKeyContext,
  documentId: string,
  input: {
    title_ru?: string;
    title_kk?: string | null;
    summary?: string | null;
    body?: string | null;
    external_reg_number?: string | null;
    due_at?: string | null;
  },
) {
  if (!(await canViewDocumentContent(ctx.userId, documentId))) return null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title_ru !== undefined) patch.title_ru = input.title_ru;
  if (input.title_kk !== undefined) patch.title_kk = input.title_kk ?? input.title_ru;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.body !== undefined) patch.body = input.body;
  if (input.external_reg_number !== undefined) {
    patch.external_reg_number = input.external_reg_number;
  }
  if (input.due_at !== undefined) patch.due_at = input.due_at;

  const { data, error } = await supabaseAdmin
    .from("documents")
    .update(patch as never)
    .eq("id", documentId)
    .select("id, reg_number, title_ru, title_kk, status, updated_at")
    .single();

  if (error) throw new Error(error.message);

  if (input.body !== undefined) {
    await registerBodyContentVersion(supabaseAdmin, {
      documentId,
      userId: ctx.userId,
      body: input.body ?? "",
      comment: "API v1 update",
    });
  }

  return data;
}

export async function v1CreateDocumentVersion(
  ctx: ApiKeyContext,
  documentId: string,
  input: { body: string; comment?: string | null },
) {
  if (!(await canViewDocumentContent(ctx.userId, documentId))) return null;

  const versionNo = await registerBodyContentVersion(supabaseAdmin, {
    documentId,
    userId: ctx.userId,
    body: input.body,
    comment: input.comment ?? "API v1 version",
  });

  await supabaseAdmin
    .from("documents")
    .update({ body: input.body, updated_at: new Date().toISOString() } as never)
    .eq("id", documentId);

  const { data: version, error } = await supabaseAdmin
    .from("document_versions")
    .select("id, document_id, version_no, content_hash, created_at")
    .eq("document_id", documentId)
    .eq("version_no", versionNo)
    .single();
  if (error) throw new Error(error.message);

  return version;
}

export async function v1CompleteTask(
  ctx: ApiKeyContext,
  taskId: string,
  input: { decision: "approve" | "reject" | "return"; comment?: string | null },
) {
  const { data: task, error: taskErr } = await supabaseAdmin
    .from("workflow_tasks")
    .select("id, assignee_id, status")
    .eq("id", taskId)
    .maybeSingle();

  if (taskErr) throw new Error(taskErr.message);
  if (!task || task.assignee_id !== ctx.userId) return null;
  if (!["pending", "in_progress"].includes(task.status as string)) {
    throw new Error("Task is not actionable");
  }

  if (input.decision !== "approve" && !input.comment?.trim()) {
    throw new Error("Comment required for reject/return");
  }

  const { data: res, error } = await supabaseAdmin.rpc(
    "app_advance_workflow_task" as never,
    {
      _task_id: taskId,
      _decision: input.decision,
      _comment: input.comment ?? null,
    } as never,
  );

  if (error) throw new Error(error.message);
  return res;
}

const CONTRACT_V1_SELECT = `
  document_id, contract_number, contract_date, valid_from, valid_to,
  amount, currency, contract_status, counterparty_id, subject_ru, subject_kk,
  documents!contract_details_document_id_fkey(id, reg_number, title_ru, title_kk, status)
`;

export async function v1ListContracts(
  ctx: ApiKeyContext,
  params: { status?: string; limit?: number; offset?: number },
) {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabaseAdmin
    .from("contract_details")
    .select(CONTRACT_V1_SELECT, { count: "exact" })
    .order("valid_to", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (params.status) q = q.eq("contract_status", params.status);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const visible = [];
  for (const row of data ?? []) {
    const docId = row.document_id as string;
    if (await canViewDocument(ctx.userId, docId)) visible.push(row);
  }

  return { data: visible, total: count ?? visible.length, limit, offset };
}

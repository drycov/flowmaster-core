import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureDocumentRegNumber } from "@/lib/documents/registration.server";
import type { ApiKeyContext } from "@/lib/integrations/api-key-auth.server";

const DOC_LIST_SELECT =
  "id, reg_number, title_ru, title_kk, status, doc_type, sla_status, due_at, created_at, updated_at, document_type_id, ref_document_types!documents_document_type_id_fkey(code)";

export async function v1ListDocuments(
  ctx: ApiKeyContext,
  params: { status?: string; limit?: number; offset?: number },
) {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabaseAdmin
    .from("documents")
    .select(DOC_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) q = q.eq("status", params.status as never);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const visible = [];
  for (const row of data ?? []) {
    const { data: canView } = await supabaseAdmin.rpc("can_view_document" as never, {
      _doc_id: row.id,
      _user: ctx.userId,
    } as never);
    if (canView) visible.push(row);
  }

  return { data: visible, total: count ?? visible.length, limit, offset };
}

export async function v1GetDocument(ctx: ApiKeyContext, documentId: string) {
  const { data: canView } = await supabaseAdmin.rpc("can_view_document" as never, {
    _doc_id: documentId,
    _user: ctx.userId,
  } as never);
  if (!canView) return null;

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(
      "id, reg_number, title_ru, title_kk, summary, body, status, doc_type, due_at, created_at, updated_at, document_type_id, priority_id, correspondent_id, ref_document_types!documents_document_type_id_fkey(code, name_ru, name_kk)",
    )
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: canContent } = await supabaseAdmin.rpc(
    "can_view_document_content" as never,
    { _doc_id: documentId, _user: ctx.userId } as never,
  );

  if (!canContent) {
    return { ...data, body: null, summary: null, content_restricted: true };
  }
  return { ...data, content_restricted: false };
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
  let documentTypeId: string | null = null;
  let docType = input.document_type_code ?? "internal";

  if (input.document_type_code) {
    const { data: dt } = await supabaseAdmin
      .from("ref_document_types")
      .select("id, code")
      .eq("code", input.document_type_code)
      .maybeSingle();
    if (dt) {
      documentTypeId = dt.id;
      docType = dt.code;
    }
  }

  const { data: row, error } = await supabaseAdmin
    .from("documents")
    .insert({
      title_ru: input.title_ru,
      title_kk: input.title_kk ?? input.title_ru,
      summary: input.summary ?? null,
      body: input.body ?? null,
      doc_type: docType,
      document_type_id: documentTypeId,
      external_reg_number: input.external_reg_number ?? null,
      received_at: input.received_at ?? null,
      created_by: ctx.userId,
      reg_number: "",
      status: "draft",
    } as never)
    .select("id, reg_number, status, title_ru")
    .single();

  if (error) throw new Error(error.message);
  const regNumber = await ensureDocumentRegNumber(row.id);
  return { ...row, reg_number: regNumber };
}

export async function v1UpdateDocumentStatus(
  ctx: ApiKeyContext,
  documentId: string,
  status: string,
) {
  const allowed = ["archived", "cancelled", "draft"];
  if (!allowed.includes(status)) {
    throw new Error(`Status must be one of: ${allowed.join(", ")}`);
  }

  const { data: canView } = await supabaseAdmin.rpc("can_view_document_content" as never, {
    _doc_id: documentId,
    _user: ctx.userId,
  } as never);
  if (!canView) return null;

  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({ status: status as never } as never)
    .eq("id", documentId)
    .select("id, reg_number, status")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function v1ListTasks(
  ctx: ApiKeyContext,
  params: { status?: string; limit?: number },
) {
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

export async function v1ImportIncoming(
  ctx: ApiKeyContext,
  items: ImportItem[],
  apiKeyId?: string,
) {
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

  const { data: incomingType } = await supabaseAdmin
    .from("ref_document_types")
    .select("id")
    .eq("code", "incoming")
    .maybeSingle();

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

      const { data: doc, error } = await supabaseAdmin
        .from("documents")
        .insert({
          title_ru: item.title_ru,
          title_kk: item.title_kk ?? item.title_ru,
          summary: item.summary ?? null,
          body: item.body ?? null,
          doc_type: "incoming",
          document_type_id: incomingType?.id ?? null,
          correspondent_id: correspondentId,
          external_reg_number: item.external_reg_number ?? null,
          received_at: item.received_at ?? new Date().toISOString(),
          created_by: ctx.userId,
          reg_number: "",
          status: "draft",
        } as never)
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      await ensureDocumentRegNumber(doc.id);
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
  const { data: canView } = await supabaseAdmin.rpc("can_view_document_content" as never, {
    _doc_id: documentId,
    _user: ctx.userId,
  } as never);
  if (!canView) return null;

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
    const bodyText = input.body ?? "";
    const { data: latest } = await supabaseAdmin
      .from("document_versions")
      .select("version_no")
      .eq("document_id", documentId)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNo = (latest?.version_no ?? 0) + 1;
    const { sha256Hex } = await import("@/lib/documents/content-hash.server");
    await supabaseAdmin.from("document_versions").insert({
      document_id: documentId,
      version_no: nextNo,
      body_snapshot: bodyText,
      content_hash: sha256Hex(bodyText),
      comment: "API v1 update",
      created_by: ctx.userId,
    } as never);
    await supabaseAdmin
      .from("documents")
      .update({ current_version: nextNo } as never)
      .eq("id", documentId);
  }

  return data;
}

export async function v1CreateDocumentVersion(
  ctx: ApiKeyContext,
  documentId: string,
  input: { body: string; comment?: string | null },
) {
  const { data: canView } = await supabaseAdmin.rpc("can_view_document_content" as never, {
    _doc_id: documentId,
    _user: ctx.userId,
  } as never);
  if (!canView) return null;

  const { data: latest } = await supabaseAdmin
    .from("document_versions")
    .select("version_no")
    .eq("document_id", documentId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNo = (latest?.version_no ?? 0) + 1;
  const { sha256Hex } = await import("@/lib/documents/content-hash.server");
  const contentHash = sha256Hex(input.body);

  const { data: version, error } = await supabaseAdmin
    .from("document_versions")
    .insert({
      document_id: documentId,
      version_no: nextNo,
      body_snapshot: input.body,
      content_hash: contentHash,
      comment: input.comment ?? "API v1 version",
      created_by: ctx.userId,
    } as never)
    .select("id, document_id, version_no, content_hash, created_at")
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("documents")
    .update({
      body: input.body,
      current_version: nextNo,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", documentId);

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

  const { data: res, error } = await supabaseAdmin.rpc("app_advance_workflow_task" as never, {
    _task_id: taskId,
    _decision: input.decision,
    _comment: input.comment ?? null,
  } as never);

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
    const { data: canView } = await supabaseAdmin.rpc("can_view_document" as never, {
      _doc_id: docId,
      _user: ctx.userId,
    } as never);
    if (canView) visible.push(row);
  }

  return { data: visible, total: count ?? visible.length, limit, offset };
}

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchProfileById } from "@/lib/auth/server";
import { attachApprovalSheetForDocument } from "@/lib/documents/approval-sheet.server";
import { insertDocumentWithRegistration } from "@/lib/documents/create.server";
import { buildTemplateAuthorDefaultsForUser } from "@/lib/templates/author-defaults.server";
import { buildSystemTemplateValues } from "@/lib/templates/system-values";
import { harmonizeTemplateSubstitutionValues } from "@/lib/templates/preset-fields";
import { startWorkflowForDocument } from "@/lib/workflow/start-workflow.server";
import {
  HR_LEAVE_TPL_APPLICATION,
  HR_LEAVE_WORKFLOW_ID,
  type HrLeaveDocKind,
} from "./leave-package.constants";

type LeaveRow = {
  id: string;
  user_id: string;
  absence_type_id: string;
  date_from: string;
  date_to: string;
  business_days: number;
  reason: string;
  document_id?: string | null;
  ref_absence_types?: { name_ru: string; name_kk: string; code?: string } | null;
};

function fmtRuDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function substitute(template: string, values: Record<string, string>): string {
  let body = template;
  for (const [k, v] of Object.entries(values)) {
    body = body.replaceAll(`{{${k}}}`, v);
  }
  return body;
}

async function loadTemplateBody(templateId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("document_templates")
    .select("schema, status")
    .eq("id", templateId)
    .single();
  if (error) throw new Error(error.message);
  const row = data as { schema?: { body_template?: string }; status?: string };
  if (row.status && row.status !== "published") {
    throw new Error("Шаблон HR не опубликован — выполните миграции или опубликуйте шаблоны");
  }
  return row.schema?.body_template ?? "";
}

export async function buildLeaveTemplateValues(
  leave: LeaveRow,
  employeeUserId: string,
): Promise<Record<string, string>> {
  const authorDefaults = await buildTemplateAuthorDefaultsForUser(employeeUserId);
  const absence = leave.ref_absence_types;
  const reasonBlock = leave.reason?.trim()
    ? `Основание: ${leave.reason.trim()}`
    : "";

  return harmonizeTemplateSubstitutionValues(
    {
      ...authorDefaults,
      ...buildSystemTemplateValues({
        title_ru: `Заявление на отпуск — ${authorDefaults.full_name ?? ""}`.trim(),
        title_kk: `Демалыс өтінімі — ${authorDefaults.full_name ?? authorDefaults.full_name_kk ?? ""}`.trim(),
        document_subject: absence?.name_ru ?? "Отпуск",
      }),
      absence_type_ru: absence?.name_ru ?? "отпуск",
      absence_type_kk: absence?.name_kk ?? absence?.name_ru ?? "демалыс",
      date_from: fmtRuDate(String(leave.date_from)),
      date_to: fmtRuDate(String(leave.date_to)),
      date_from_iso: String(leave.date_from).slice(0, 10),
      date_to_iso: String(leave.date_to).slice(0, 10),
      business_days: String(leave.business_days ?? 0),
      reason: leave.reason?.trim() ?? "",
      reason_block: reasonBlock,
      leave_period: `${fmtRuDate(String(leave.date_from))} — ${fmtRuDate(String(leave.date_to))}`,
    },
    {},
  );
}

async function linkLeaveDocument(
  leaveRequestId: string,
  documentId: string,
  docKind: HrLeaveDocKind,
  sortOrder: number,
) {
  const { error } = await supabaseAdmin.from("leave_request_documents" as never).upsert(
    {
      leave_request_id: leaveRequestId,
      document_id: documentId,
      doc_kind: docKind,
      sort_order: sortOrder,
    } as never,
    { onConflict: "leave_request_id,doc_kind" },
  );
  if (error) throw new Error(error.message);
}

/** Create application document + approval sheet + start leave workflow. */
export async function createLeaveDocumentPackage(
  leaveRequestId: string,
  employeeUserId: string,
): Promise<{ application_document_id: string; run_id: string }> {
  const { data: leaveRaw, error: leaveErr } = await supabaseAdmin
    .from("leave_requests" as never)
    .select(
      `id, user_id, absence_type_id, date_from, date_to, business_days, reason, document_id,
       ref_absence_types!leave_requests_absence_type_id_fkey(name_ru, name_kk, code)`,
    )
    .eq("id", leaveRequestId)
    .single();
  if (leaveErr) throw new Error(leaveErr.message);

  const leave = leaveRaw as LeaveRow;
  if (leave.document_id) {
    throw new Error("Комплект документов для этой заявки уже создан");
  }

  const employee = await fetchProfileById(employeeUserId);
  if (!employee) throw new Error("Профиль сотрудника не найден");

  const values = await buildLeaveTemplateValues(leave, employeeUserId);
  const bodyTemplate = await loadTemplateBody(HR_LEAVE_TPL_APPLICATION);
  const titleRu = `Заявление на ${values.absence_type_ru} — ${values.full_name || values.executor_name || "сотрудник"}`;
  const titleKk = `Демалыс өтінімі — ${values.full_name || values.executor_name || "қызметкер"}`;
  let body = bodyTemplate ? substitute(bodyTemplate, values) : "";

  const doc = await insertDocumentWithRegistration({
    title_ru: titleRu,
    title_kk: titleKk,
    body,
    template_id: HR_LEAVE_TPL_APPLICATION,
    workflow_id: HR_LEAVE_WORKFLOW_ID,
    created_by: employeeUserId,
    summary: values.leave_period,
  });

  if (bodyTemplate) {
    const withReg = substitute(bodyTemplate, {
      ...values,
      ...buildSystemTemplateValues({
        title_ru: titleRu,
        title_kk: titleKk,
        reg_number: doc.reg_number,
        document_subject: values.absence_type_ru,
      }),
    });
    if (withReg !== body) {
      body = withReg;
      await supabaseAdmin.from("documents").update({ body } as never).eq("id", doc.id);
    }
  }

  await linkLeaveDocument(leaveRequestId, doc.id, "application", 10);

  const { error: updErr } = await supabaseAdmin
    .from("leave_requests" as never)
    .update({ document_id: doc.id } as never)
    .eq("id", leaveRequestId);
  if (updErr) throw new Error(updErr.message);

  try {
    const sheet = await attachApprovalSheetForDocument({
      parentDocumentId: doc.id,
      userId: employeeUserId,
    });
    if (sheet?.sheetDocumentId) {
      await linkLeaveDocument(leaveRequestId, sheet.sheetDocumentId, "approval_sheet", 20);
    }
  } catch (err) {
    console.warn("[hr-leave-package] approval sheet:", err);
  }

  const runId = await startWorkflowForDocument(supabaseAdmin, {
    documentId: doc.id,
    workflowId: HR_LEAVE_WORKFLOW_ID,
    actorId: employeeUserId,
  });

  return { application_document_id: doc.id, run_id: runId };
}

export async function listLeaveRequestDocuments(leaveRequestId: string) {
  const { data, error } = await supabaseAdmin
    .from("leave_request_documents" as never)
    .select(
      `id, doc_kind, sort_order, created_at,
       documents!leave_request_documents_document_id_fkey(
         id, reg_number, title_ru, title_kk, status, created_at
       )`,
    )
    .eq("leave_request_id", leaveRequestId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

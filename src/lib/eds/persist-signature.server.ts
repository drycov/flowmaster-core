import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSignatureVerification } from "@/lib/api/signatures.functions";
import { resolveTaskSignatureProvider } from "@/lib/workflow/signature-provider";

export type SignatureInsertInput = {
  document_id: string;
  version_id?: string | null;
  payload: string;
  cert_subject?: string | null;
  cert_serial?: string | null;
  cert_issuer?: string | null;
  signature_type?: string;
  workflow_task_id?: string | null;
  signer_iin?: string | null;
  signer_bin?: string | null;
  cert_valid_from?: string | null;
  cert_valid_to?: string | null;
  cert_fingerprint?: string | null;
  content_hash?: string | null;
  signing_provider?: "ncalayer" | "egov_qr";
};

export async function persistDocumentSignature(
  supabase: SupabaseClient,
  userId: string,
  data: SignatureInsertInput,
) {
  const { workflow_task_id, signing_provider = "ncalayer", ...signatureData } = data;

  const [{ data: profile }, { data: org }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("iin").eq("id", userId).maybeSingle(),
    supabase.from("organization").select("settings").limit(1).maybeSingle(),
    supabaseAdmin.rpc("is_admin" as never, { _user_id: userId } as never),
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
      .select("id, context, workflows(definition)")
      .eq("id", signTaskRunId)
      .maybeSingle();
    const provider = resolveTaskSignatureProvider(
      { node_id: signTaskNodeId, run_id: signTaskRunId },
      run
        ? [
            {
              id: run.id as string | undefined,
              context: run.context as { nodes?: { id: string; data?: { config?: { signature_provider?: string } } }[] } | null,
              workflows: (run.workflows as { definition?: { nodes?: { id: string; data?: { config?: { signature_provider?: string } } }[] } } | null) ?? undefined,
            },
          ]
        : [],
    );

    if (provider === "ncalayer" && signing_provider !== "ncalayer") {
      throw new Error("Для этого этапа требуется подпись через NCALayer");
    }
    if (provider === "egov_qr" && signing_provider !== "egov_qr") {
      throw new Error("Для этого этапа требуется подпись через eGov QR");
    }
    if (data.signature_type !== "CMS") {
      throw new Error("Поддерживается только CMS-подпись");
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

  const verificationDetails = {
    ...(verification?.details ?? {}),
    signing_provider,
  };

  const { error } = await supabase.from("document_signatures").insert({
    ...signatureData,
    signature_type: data.signature_type ?? "CMS",
    signer_id: userId,
    status: "signed",
    signed_at: signedAt,
    verification_status: verification?.status ?? "unverified",
    verified_at: verification?.verified_at ?? null,
    verification_details: verificationDetails,
  } as never);
  if (error) throw new Error(error.message);

  if (signTaskId) {
    const { error: wfError } = await supabaseAdmin.rpc(
      "app_advance_workflow_task" as never,
      {
        _task_id: signTaskId,
        _decision: "approve",
        _comment: null,
      } as never,
    );
    if (wfError) throw new Error(wfError.message);
  }

  return { ok: true as const, signTaskId };
}

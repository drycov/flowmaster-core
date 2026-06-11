import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceModuleLicense } from "../_helpers";
import { runSignatureVerification } from "@/lib/api/signatures.functions";

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
        .select("context, workflows(definition)")
        .eq("id", signTaskRunId)
        .maybeSingle();
      type WfNodeCtx = {
        id: string;
        data?: { config?: { signature_provider?: string } };
      };
      const ctx = run?.context as { nodes?: WfNodeCtx[] } | null;
      const wfDef = (run?.workflows as { definition?: { nodes?: WfNodeCtx[] } } | null)
        ?.definition;
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

    return { ok: true };
  });

import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceModuleLicense } from "../_helpers";
import { persistDocumentSignature } from "@/lib/eds/persist-signature.server";
import { hashSignPayloadBase64, toSignPayloadBase64 } from "@/lib/eds/sign-payload";
import {
  buildSigexSignPayload,
  extractCmsFromSigexResponse,
  fetchSigexEgovQrSignatures,
  isSigexEgovQrEnabled,
  registerSigexEgovQr,
  sendSigexEgovQrData,
} from "@/lib/eds/sigex-egov-qr.server";
import { extractCmsCertInfo, extractFirstCertBase64FromCms } from "@/lib/eds/verify-cms";

type EgovQrSessionRow = {
  id: string;
  user_id: string;
  document_id: string;
  workflow_task_id: string | null;
  sign_text_hash: string;
  data_url: string;
  sign_url: string;
  expire_at: string;
  status: string;
  error_message: string | null;
};

function certFingerprintFromCms(cmsB64: string): string | null {
  const certBase64 = extractFirstCertBase64FromCms(cmsB64);
  if (!certBase64) return null;
  return createHash("sha256").update(Buffer.from(certBase64, "base64")).digest("hex");
}

async function loadSession(sessionId: string, userId: string): Promise<EgovQrSessionRow> {
  const { data: session, error } = await supabaseAdmin
    .from("egov_qr_sessions" as never)
    .select("*")
    .eq("id" as never, sessionId)
    .eq("user_id" as never, userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) throw new Error("Сессия eGov QR не найдена");
  return session as EgovQrSessionRow;
}

async function markSession(
  sessionId: string,
  patch: { status: string; error_message?: string | null; sign_url?: string },
) {
  await supabaseAdmin
    .from("egov_qr_sessions" as never)
    .update(patch as never)
    .eq("id" as never, sessionId);
}

export const getEgovQrSigningAvailability = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: isSigexEgovQrEnabled(),
}));

export const startEgovQrSigning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      workflow_task_id: z.string().uuid(),
      sign_text: z.string().min(1),
      title_ru: z.string().min(1),
      title_kk: z.string().optional(),
      back_url: z.string().url().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "eds_signing", "write");
    if (!isSigexEgovQrEnabled()) {
      throw new Error("eGov QR не настроен (SIGEX_EGOV_QR_ENABLED=false или SIGEX_API_URL пуст)");
    }

    const { supabase, userId } = context;
    const { data: task, error: taskErr } = await supabase
      .from("workflow_tasks")
      .select("id, document_id, assignee_id, status, action_required, node_type")
      .eq("id", data.workflow_task_id)
      .single();
    if (taskErr || !task) throw new Error("Задача подписания не найдена");
    if (task.document_id !== data.document_id) throw new Error("Задача не относится к документу");
    if (task.assignee_id !== userId) throw new Error("Нет права подписать этот документ");
    if (task.status !== "pending") throw new Error("Задача подписания уже завершена");

    const { data: docRow, error: docErr } = await supabase
      .from("documents")
      .select("organization_id")
      .eq("id", data.document_id)
      .single();
    if (docErr || !docRow?.organization_id) throw new Error("Организация документа не определена");
    const orgId = docRow.organization_id;

    const payloadB64 = toSignPayloadBase64(data.sign_text);
    const signTextHash = hashSignPayloadBase64(payloadB64);

    const sigex = await registerSigexEgovQr({
      description: data.title_ru,
      backUrl: data.back_url,
    });

    const expireAt = new Date(sigex.expireAt).toISOString();
    const { data: session, error: insErr } = await supabaseAdmin
      .from("egov_qr_sessions" as never)
      .insert({
        organization_id: orgId,
        user_id: userId,
        document_id: data.document_id,
        workflow_task_id: data.workflow_task_id,
        sign_text_hash: signTextHash,
        data_url: sigex.dataURL,
        sign_url: sigex.signURL,
        qr_code: sigex.qrCode,
        mobile_launch_url: sigex.eGovMobileLaunchLink ?? null,
        expire_at: expireAt,
        status: "created",
      } as never)
      .select("id")
      .single();
    if (insErr || !session) throw new Error(insErr?.message ?? "Не удалось создать сессию");

    const row = session as { id: string };
    return {
      session_id: row.id,
      qr_code: sigex.qrCode,
      expire_at: expireAt,
      mobile_launch_url: sigex.eGovMobileLaunchLink ?? null,
      business_launch_url: sigex.eGovBusinessLaunchLink ?? null,
    };
  });

export const sendEgovQrSigningData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      session_id: z.string().uuid(),
      sign_text: z.string().min(1),
      title_ru: z.string().min(1),
      title_kk: z.string().optional(),
      reg_number: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "eds_signing", "write");
    const session = await loadSession(data.session_id, context.userId);

    if (session.status === "completed") return { status: "completed" as const };
    if (session.status === "canceled") throw new Error("Подписание отменено");
    if (session.status === "failed") {
      throw new Error(session.error_message ?? "Ошибка eGov QR");
    }
    if (new Date(session.expire_at).getTime() < Date.now()) {
      await markSession(data.session_id, { status: "expired" });
      throw new Error("Срок действия QR-кода истёк");
    }

    const payloadB64 = toSignPayloadBase64(data.sign_text);
    const signTextHash = hashSignPayloadBase64(payloadB64);
    if (session.sign_text_hash !== signTextHash) {
      throw new Error("Данные для подписи изменились");
    }

    if (session.status === "data_sent") {
      return { status: "data_sent" as const, sign_url: session.sign_url };
    }

    const meta = data.reg_number
      ? [{ name: "Рег. №", value: data.reg_number }]
      : undefined;

    const payload = buildSigexSignPayload({
      titleRu: data.title_ru,
      titleKk: data.title_kk,
      payloadBase64: payloadB64,
      meta,
    });

    try {
      const sent = await sendSigexEgovQrData(session.data_url, payload);
      await markSession(data.session_id, {
        status: "data_sent",
        sign_url: sent.signURL,
      });
      return { status: "data_sent" as const, sign_url: sent.signURL };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка отправки данных в SIGEX";
      await markSession(data.session_id, { status: "failed", error_message: message });
      throw new Error(message);
    }
  });

export const completeEgovQrSigning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      session_id: z.string().uuid(),
      sign_text: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "eds_signing", "write");
    const session = await loadSession(data.session_id, context.userId);

    if (session.status === "completed") return { ok: true as const };
    if (session.status === "canceled") throw new Error("Подписание отменено");
    if (new Date(session.expire_at).getTime() < Date.now()) {
      await markSession(data.session_id, { status: "expired" });
      throw new Error("Срок действия QR-кода истёк");
    }

    const payloadB64 = toSignPayloadBase64(data.sign_text);
    if (session.sign_text_hash !== hashSignPayloadBase64(payloadB64)) {
      throw new Error("Данные для подписи изменились");
    }

    if (session.status === "created") {
      return { ok: false as const, status: "waiting_data" as const };
    }

    const signUrl = session.sign_url;
    if (!signUrl) throw new Error("signURL не задан");

    let signed;
    try {
      signed = await fetchSigexEgovQrSignatures(signUrl);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка получения подписи";
      if (message.includes("timeout") || message.includes("aborted")) {
        return { ok: false as const, status: "waiting_signature" as const };
      }
      await markSession(data.session_id, { status: "failed", error_message: message });
      throw new Error(message);
    }

    if (signed.status === "CANCELED") {
      await markSession(data.session_id, { status: "canceled" });
      throw new Error("Подписание отменено в eGov mobile");
    }

    const cms = extractCmsFromSigexResponse(signed);
    const cert = extractCmsCertInfo(cms);
    const fingerprint = certFingerprintFromCms(cms);

    await persistDocumentSignature(context.supabase, context.userId, {
      document_id: session.document_id,
      payload: cms,
      signature_type: "CMS",
      workflow_task_id: session.workflow_task_id,
      cert_subject: cert?.subject ?? null,
      cert_serial: cert?.serial ?? null,
      cert_issuer: cert?.issuer ?? null,
      signer_iin: cert?.iin ?? null,
      signer_bin: cert?.bin ?? null,
      cert_valid_from: cert?.validFrom?.toISOString?.() ?? null,
      cert_valid_to: cert?.validTo?.toISOString?.() ?? null,
      cert_fingerprint: fingerprint,
      content_hash: session.sign_text_hash,
      signing_provider: "egov_qr",
    });

    await markSession(data.session_id, { status: "completed" });
    return { ok: true as const };
  });

export const cancelEgovQrSigning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const session = await loadSession(data.session_id, context.userId);
    if (session.status === "completed") return { ok: true as const };
    await markSession(data.session_id, { status: "canceled" });
    return { ok: true as const };
  });

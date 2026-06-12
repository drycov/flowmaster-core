import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cancelEgovQrSigning,
  completeEgovQrSigning,
  sendEgovQrSigningData,
  startEgovQrSigning,
} from "@/lib/api/documents.functions";
import { useI18n } from "@/i18n";

export type EgovQrPhase =
  | "idle"
  | "starting"
  | "scan"
  | "waiting_signature"
  | "done"
  | "error";

type Args = {
  documentId: string;
  workflowTaskId: string;
  signText: string;
  titleRu: string;
  titleKk?: string;
  regNumber?: string;
  backUrl?: string;
  onSuccess?: () => void;
};

export function useEgovQrSigning(args: Args) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<EgovQrPhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [mobileLaunchUrl, setMobileLaunchUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataSentRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["document", args.documentId] });
    qc.invalidateQueries({ queryKey: ["myTasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }, [qc, args.documentId]);

  const completeOnce = useCallback(async () => {
    if (!sessionId) return;
    const result = await completeEgovQrSigning({
      data: { session_id: sessionId, sign_text: args.signText },
    });
    if (result.ok) {
      stopPolling();
      setPhase("done");
      toast.success(t("egovQr.signed"));
      invalidate();
      args.onSuccess?.();
      return;
    }
    if (result.status === "waiting_data") {
      setPhase("scan");
      return;
    }
    setPhase("waiting_signature");
  }, [sessionId, args, stopPolling, t, invalidate]);

  const startMutation = useMutation({
    mutationFn: async () => {
      setPhase("starting");
      setErrorMessage(null);
      dataSentRef.current = false;
      const session = await startEgovQrSigning({
        data: {
          document_id: args.documentId,
          workflow_task_id: args.workflowTaskId,
          sign_text: args.signText,
          title_ru: args.titleRu,
          title_kk: args.titleKk,
          back_url: args.backUrl,
        },
      });
      setSessionId(session.session_id);
      setQrCode(session.qr_code);
      setMobileLaunchUrl(session.mobile_launch_url);
      setPhase("scan");
      return session;
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : t("egovQr.error");
      setPhase("error");
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  useEffect(() => {
    if (phase !== "scan" && phase !== "waiting_signature") return;
    if (!sessionId) return;

    const sendData = async () => {
      if (dataSentRef.current) return;
      try {
        await sendEgovQrSigningData({
          data: {
            session_id: sessionId,
            sign_text: args.signText,
            title_ru: args.titleRu,
            title_kk: args.titleKk,
            reg_number: args.regNumber,
          },
        });
        dataSentRef.current = true;
        setPhase("waiting_signature");
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("egovQr.error");
        if (msg.includes("timeout") || msg.includes("aborted")) return;
        setPhase("error");
        setErrorMessage(msg);
        stopPolling();
      }
    };

    void sendData();
    pollRef.current = setInterval(() => {
      void completeOnce();
    }, 4000);

    return stopPolling;
  }, [
    phase,
    sessionId,
    args.signText,
    args.titleRu,
    args.titleKk,
    args.regNumber,
    completeOnce,
    stopPolling,
    t,
  ]);

  const cancel = useCallback(async () => {
    stopPolling();
    if (sessionId) {
      try {
        await cancelEgovQrSigning({ data: { session_id: sessionId } });
      } catch {
        /* ignore */
      }
    }
    setPhase("idle");
    setSessionId(null);
    setQrCode(null);
    setMobileLaunchUrl(null);
    setErrorMessage(null);
    dataSentRef.current = false;
  }, [sessionId, stopPolling]);

  const start = useCallback(() => {
    startMutation.mutate();
  }, [startMutation]);

  return {
    phase,
    qrCode,
    mobileLaunchUrl,
    errorMessage,
    isBusy: startMutation.isPending || phase === "starting" || phase === "scan" || phase === "waiting_signature",
    start,
    cancel,
  };
}

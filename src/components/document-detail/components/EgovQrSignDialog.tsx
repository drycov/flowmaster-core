import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, QrCode, Smartphone } from "lucide-react";
import { useI18n } from "@/i18n";
import { useEgovQrSigning } from "@/components/document-detail/hooks/useEgovQrSigning";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  workflowTaskId: string;
  signText: string;
  titleRu: string;
  titleKk?: string;
  regNumber?: string;
  onSigned?: () => void;
};

export function EgovQrSignDialog({
  open,
  onOpenChange,
  documentId,
  workflowTaskId,
  signText,
  titleRu,
  titleKk,
  regNumber,
  onSigned,
}: Props) {
  const { t } = useI18n();
  const signing = useEgovQrSigning({
    documentId,
    workflowTaskId,
    signText,
    titleRu,
    titleKk,
    regNumber,
    backUrl: typeof window !== "undefined" ? window.location.href : undefined,
    onSuccess: () => {
      onSigned?.();
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) signing.start();
    else void signing.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start/cancel only when dialog opens/closes
  }, [open]);

  const statusText =
    signing.phase === "starting"
      ? t("egovQr.starting")
      : signing.phase === "scan"
        ? t("egovQr.scanHint")
        : signing.phase === "waiting_signature"
          ? t("egovQr.signHint")
          : signing.phase === "done"
            ? t("egovQr.signed")
            : signing.phase === "error"
              ? signing.errorMessage ?? t("egovQr.error")
              : t("egovQr.idle");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void signing.cancel();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            {t("egovQr.title")}
          </DialogTitle>
          <DialogDescription>{t("egovQr.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {signing.qrCode ? (
            <img
              src={`data:image/png;base64,${signing.qrCode}`}
              alt={t("egovQr.qrAlt")}
              className="h-52 w-52 rounded border bg-white p-2"
            />
          ) : (
            <div className="flex h-52 w-52 items-center justify-center rounded border bg-muted/30">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">{statusText}</p>

          {signing.mobileLaunchUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={signing.mobileLaunchUrl} target="_blank" rel="noreferrer">
                <Smartphone className="mr-2 h-4 w-4" />
                {t("egovQr.openMobile")}
              </a>
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={signing.phase === "done"}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

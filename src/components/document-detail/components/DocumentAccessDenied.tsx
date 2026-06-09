import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldOff, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { requestDocumentAccess } from "@/lib/api/access-grants.functions";
import { toast } from "sonner";
import type { getDocumentAccessState } from "@/lib/api/access-grants.functions";

type AccessState = NonNullable<Awaited<ReturnType<typeof getDocumentAccessState>>>;

interface DocumentAccessDeniedProps {
  documentId: string;
  access: AccessState;
}

export function DocumentAccessDenied({ documentId, access }: DocumentAccessDeniedProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");

  const requestMutation = useMutation({
    mutationFn: () =>
      requestDocumentAccess({
        data: { document_id: documentId, reason: reason.trim() },
      }),
    onSuccess: () => {
      toast.success(t("access.requestSent"));
      setReason("");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("access.requestError")),
  });

  const grantStatus = access.grant?.status;

  return (
    <Card className="max-w-lg mx-auto mt-12 rounded-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldOff className="w-5 h-5" />
          {t("access.deniedTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {access.document?.reg_number ? (
          <p>
            <span className="text-muted-foreground">{t("doc.regNumber")}: </span>
            <span className="font-mono">{access.document.reg_number}</span>
          </p>
        ) : null}
        <p className="text-muted-foreground">{t("access.deniedHint")}</p>

        {grantStatus === "pending" ? (
          <p className="text-amber-600 font-medium">{t("access.pendingReview")}</p>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("access.reasonPlaceholder")}
              rows={4}
            />
            <Button
              disabled={requestMutation.isPending || reason.trim().length < 3}
              onClick={() => requestMutation.mutate()}
            >
              {requestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("access.request")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

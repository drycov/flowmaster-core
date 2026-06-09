import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Loader2 } from "lucide-react";
import { useI18n, localized } from "@/i18n";
import { getDocumentAccessState, requestDocumentAccess } from "@/lib/api/access-grants.functions";
import { toast } from "sonner";

interface DocumentAccessPanelProps {
  documentId: string;
  contentRestricted?: boolean;
}

export function DocumentAccessPanel({ documentId, contentRestricted }: DocumentAccessPanelProps) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const { data: access } = useQuery({
    queryKey: ["document-access", documentId],
    queryFn: () => getDocumentAccessState({ data: { document_id: documentId } }),
    enabled: !!contentRestricted,
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      requestDocumentAccess({
        data: { document_id: documentId, reason: reason.trim() },
      }),
    onSuccess: () => {
      toast.success(t("access.requestSent"));
      setReason("");
      qc.invalidateQueries({ queryKey: ["document-access", documentId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("access.requestError")),
  });

  if (!contentRestricted) return null;

  const level = access?.document?.access_level;
  const levelName = level
    ? localized(level as { name_ru: string; name_kk: string }, locale, "name")
    : null;
  const grantStatus = access?.grant?.status;

  return (
    <Card className="rounded-sm border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <Lock className="w-4 h-4" />
          {t("access.contentRestricted")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {levelName ? (
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("access.requiredLevel")}:</span>
            <Badge variant="outline">{levelName}</Badge>
          </div>
        ) : null}

        <p className="text-muted-foreground text-xs">{t("access.restrictedHint")}</p>

        {grantStatus === "pending" ? (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {t("access.pendingReview")}
          </p>
        ) : grantStatus === "rejected" ? (
          <p className="text-xs text-destructive">{t("access.rejected")}</p>
        ) : !access?.can_view_content ? (
          <div className="space-y-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("access.reasonPlaceholder")}
              rows={3}
              className="text-sm"
            />
            <Button
              size="sm"
              disabled={requestMutation.isPending || reason.trim().length < 3}
              onClick={() => requestMutation.mutate()}
            >
              {requestMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              {t("access.request")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

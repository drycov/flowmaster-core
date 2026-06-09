import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Loader2 } from "lucide-react";
import { useI18n, localized } from "@/i18n";
import {
  listDocumentAccessGrants,
  resolveDocumentAccessGrant,
} from "@/lib/api/access-grants.functions";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

interface DocumentAccessGrantsPanelProps {
  documentId: string;
  canReview?: boolean;
}

export function DocumentAccessGrantsPanel({
  documentId,
  canReview,
}: DocumentAccessGrantsPanelProps) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  const { data: grants = [] } = useQuery({
    queryKey: ["document-access-grants", documentId],
    queryFn: () =>
      listDocumentAccessGrants({
        data: { document_id: documentId, status: "pending" },
      }),
    enabled: !!canReview,
  });

  const resolveMutation = useMutation({
    mutationFn: (args: { grant_id: string; decision: "approved" | "rejected" }) =>
      resolveDocumentAccessGrant({ data: args }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.decision === "approved" ? t("access.approved") : t("access.denied"),
      );
      qc.invalidateQueries({ queryKey: ["document-access-grants", documentId] });
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("access.reviewError")),
  });

  if (!canReview || grants.length === 0) return null;

  return (
    <Card className="rounded-sm border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <UserCheck className="w-4 h-4" />
          {t("access.pendingRequests")}
          <Badge variant="secondary">{grants.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {grants.map((g) => {
          const profile = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
          const name = profile
            ? localized(profile, locale, "full_name") || profile.email
            : g.user_id;

          return (
            <div key={g.id} className="border rounded-sm p-3 space-y-2 text-sm">
              <div className="font-medium">{name}</div>
              <p className="text-xs text-muted-foreground">{g.reason}</p>
              <div className="text-[10px] text-muted-foreground">
                {fmtDate(g.created_at, locale)}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7"
                  disabled={resolveMutation.isPending}
                  onClick={() =>
                    resolveMutation.mutate({ grant_id: g.id, decision: "approved" })
                  }
                >
                  {resolveMutation.isPending ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : null}
                  {t("access.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={resolveMutation.isPending}
                  onClick={() =>
                    resolveMutation.mutate({ grant_id: g.id, decision: "rejected" })
                  }
                >
                  {t("access.reject")}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

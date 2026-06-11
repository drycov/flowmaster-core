import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LeaveStatusBadge } from "@/components/hr/LeaveStatusBadge";
import { HrEmptyState } from "@/components/hr/HrEmptyState";
import { HrSubNav } from "@/components/hr/HrSubNav";
import { useI18n, localized } from "@/i18n";
import { decideLeaveRequest, listPendingLeaveApprovals } from "@/lib/api/hr.functions";
import { fmtDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/hr/leave/approvals")({
  beforeLoad: () => requireModule("hr"),
  component: LeaveApprovalsPage,
});

function LeaveApprovalsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["pending-leave-approvals"],
    queryFn: listPendingLeaveApprovals,
  });

  const decideMut = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      decideLeaveRequest({
        data: {
          id,
          decision,
          decision_note: noteById[id]?.trim() || undefined,
        },
      }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === "approved" ? t("hr.leave.approved") : t("hr.leave.rejected"));
      qc.invalidateQueries({ queryKey: ["pending-leave-approvals"] });
      qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <PageHeader
        title={t("hr.leave.approvalsTitle")}
        description={t("hr.leave.approvalsDescription")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/leave">{t("hr.leave.backToMine")}</Link>
          </Button>
        }
      />
      <PageBody className="max-w-3xl space-y-4">
        <HrSubNav />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.leave.pendingQueue")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <HrEmptyState title={t("hr.leave.noPending")} />
            ) : (
              <div className="space-y-4">
                {requests.map((raw) => {
                  const row = raw as Record<string, unknown>;
                  const id = String(row.id);
                  const type = row.ref_absence_types as { name_ru: string; name_kk: string } | null;
                  const employee = row.employee as {
                    full_name_ru?: string;
                    full_name_kk?: string;
                  } | null;
                  return (
                    <div key={id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {employee ? localized(employee, locale, "full_name") : "—"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {type ? localized(type, locale, "name") : "—"} ·{" "}
                            {fmtDateShort(String(row.date_from))} —{" "}
                            {fmtDateShort(String(row.date_to))}
                            {row.business_days
                              ? ` · ${row.business_days} ${t("hr.leave.businessDays")}`
                              : ""}
                          </div>
                          {row.reason ? <p className="mt-1 text-sm">{String(row.reason)}</p> : null}
                        </div>
                        <LeaveStatusBadge status={String(row.status)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("hr.leave.decisionNote")}</Label>
                        <Input
                          value={noteById[id] ?? ""}
                          onChange={(e) =>
                            setNoteById((prev) => ({ ...prev, [id]: e.target.value }))
                          }
                          placeholder={t("hr.leave.decisionNotePlaceholder")}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={decideMut.isPending}
                          onClick={() => decideMut.mutate({ id, decision: "approved" })}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          {t("hr.leave.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decideMut.isPending}
                          onClick={() => decideMut.mutate({ id, decision: "rejected" })}
                        >
                          <X className="mr-1 h-4 w-4" />
                          {t("hr.leave.reject")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

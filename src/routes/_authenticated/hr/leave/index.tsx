import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, CalendarRange, ClipboardList, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeaveStatusBadge } from "@/components/hr/LeaveStatusBadge";
import { useI18n, localized } from "@/i18n";
import {
  createLeaveRequest,
  decideLeaveRequest,
  getMyLeaveBalance,
  listAbsenceTypes,
  listMyLeaveRequests,
  listPendingLeaveApprovals,
} from "@/lib/api/hr.functions";
import { fmtDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/hr/leave/")({
  beforeLoad: () => requireModule("hr"),
  component: LeavePage,
});

function LeavePage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [typeId, setTypeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");

  const { data: types = [] } = useQuery({ queryKey: ["absence-types"], queryFn: listAbsenceTypes });
  const { data: balance } = useQuery({
    queryKey: ["my-leave-balance"],
    queryFn: getMyLeaveBalance,
  });
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["my-leave-requests"],
    queryFn: listMyLeaveRequests,
  });
  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["pending-leave-approvals"],
    queryFn: listPendingLeaveApprovals,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createLeaveRequest({
        data: {
          absence_type_id: typeId,
          date_from: dateFrom,
          date_to: dateTo,
          reason: reason.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("hr.leave.created"));
      qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balance"] });
      setDateFrom("");
      setDateTo("");
      setReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => decideLeaveRequest({ data: { id, decision: "cancelled" } }),
    onSuccess: () => {
      toast.success(t("hr.leave.cancelled"));
      qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeId || !dateFrom || !dateTo) {
      toast.error(t("hr.leave.fillRequired"));
      return;
    }
    createMut.mutate();
  };

  return (
    <>
      <PageHeader
        title={t("hr.leave.title")}
        description={t("hr.leave.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/hr/leave/schedule">
                <CalendarRange className="mr-1 h-4 w-4" />
                {t("hr.leave.schedule.open")}
              </Link>
            </Button>
            {pendingApprovals.length > 0 ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/hr/leave/approvals">
                  <ClipboardList className="mr-1 h-4 w-4" />
                  {t("hr.leave.approvalsLink")} ({pendingApprovals.length})
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <PageBody className="max-w-4xl space-y-6">
        {balance && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" />
                {t("hr.leave.balanceTitle")} {balance.year}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">{t("hr.leave.entitled")}: </span>
                <span className="font-medium">{balance.entitled_days}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("hr.leave.used")}: </span>
                <span className="font-medium">{balance.used_days}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("hr.leave.remaining")}: </span>
                <span className="font-semibold text-primary">{balance.remaining_days}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.leave.newRequest")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("hr.leave.type")}</Label>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("hr.leave.typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((type) => {
                      const row = type as { id: string; name_ru: string; name_kk: string };
                      return (
                        <SelectItem key={row.id} value={row.id}>
                          {localized(row, locale, "name")}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("hr.leave.dateFrom")}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("hr.leave.dateTo")}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("hr.leave.reason")}</Label>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("hr.leave.reasonPlaceholder")}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {t("hr.leave.submit")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.leave.myRequests")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("hr.leave.empty")}</p>
            ) : (
              <div className="space-y-3">
                {requests.map((raw) => {
                  const row = raw as Record<string, unknown>;
                  const type = row.ref_absence_types as { name_ru: string; name_kk: string } | null;
                  return (
                    <div
                      key={String(row.id)}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="font-medium">
                          {type ? localized(type, locale, "name") : "—"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {fmtDateShort(String(row.date_from))} —{" "}
                          {fmtDateShort(String(row.date_to))}
                          {row.business_days
                            ? ` · ${row.business_days} ${t("hr.leave.businessDays")}`
                            : ""}
                        </div>
                        {row.reason ? (
                          <p className="text-sm text-muted-foreground">{String(row.reason)}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <LeaveStatusBadge status={String(row.status)} />
                        {row.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={cancelMut.isPending}
                            onClick={() => cancelMut.mutate(String(row.id))}
                          >
                            {t("hr.leave.cancel")}
                          </Button>
                        )}
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

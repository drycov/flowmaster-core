import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeaveStatusBadge } from "@/components/hr/LeaveStatusBadge";
import { HrEmptyState } from "@/components/hr/HrEmptyState";
import { HrSubNav } from "@/components/hr/HrSubNav";
import { ReferenceCatalogLinks } from "@/components/references/ReferenceCatalogLinks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n, localized } from "@/i18n";
import {
  decideLeaveRequest,
  listOrgLeaveBalances,
  listOrgLeaveRequests,
  updateLeaveBalance,
} from "@/lib/api/hr.functions";
import { fmtDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/hr/admin/")({
  beforeLoad: () => requireModule("hr", "manage"),
  component: HrAdminPage,
});

const STATUS_FILTER = ["all", "pending", "approved", "rejected", "cancelled"] as const;

function HrAdminPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTER)[number]>("all");
  const [editEntitled, setEditEntitled] = useState<Record<string, string>>({});

  const statusParam =
    statusFilter === "all" ? undefined : (statusFilter as "pending" | "approved" | "rejected" | "cancelled");

  const {
    data: requests = [],
    isLoading: requestsLoading,
    error: requestsError,
  } = useQuery({
    queryKey: ["org-leave-requests", statusFilter],
    queryFn: () => listOrgLeaveRequests({ data: statusParam ? { status: statusParam } : undefined }),
  });

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ["org-leave-balances", year],
    queryFn: () => listOrgLeaveBalances({ data: { year } }),
  });

  const pendingCount = useMemo(
    () => requests.filter((r) => (r as { status: string }).status === "pending").length,
    [requests],
  );

  const decideMut = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      decideLeaveRequest({ data: { id, decision } }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === "approved" ? t("hr.leave.approved") : t("hr.leave.rejected"));
      qc.invalidateQueries({ queryKey: ["org-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["org-leave-balances"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const balanceMut = useMutation({
    mutationFn: ({ userId, entitled }: { userId: string; entitled: number }) =>
      updateLeaveBalance({ data: { user_id: userId, year, entitled_days: entitled } }),
    onSuccess: () => {
      toast.success(t("hr.admin.balanceSaved"));
      qc.invalidateQueries({ queryKey: ["org-leave-balances"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <PageHeader
        title={t("hr.admin.title")}
        description={t("hr.admin.description")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/leave/approvals">{t("hr.leave.approvalsLink")}</Link>
          </Button>
        }
      />
      <PageBody className="max-w-6xl space-y-4">
        <HrSubNav />
        <ReferenceCatalogLinks section="hr" titleKey="hr.admin.catalogLinksTitle" />

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">{t("hr.admin.tabRequests")}</TabsTrigger>
            <TabsTrigger value="balances">{t("hr.admin.tabBalances")}</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`hr.admin.statusFilter.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pendingCount > 0 && statusFilter !== "pending" ? (
                <span className="text-sm text-muted-foreground">
                  {t("hr.admin.pendingHint").replace("{n}", String(pendingCount))}
                </span>
              ) : null}
            </div>

            {requestsError ? (
              <p className="text-sm text-destructive">
                {requestsError instanceof Error ? requestsError.message : String(requestsError)}
              </p>
            ) : requestsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <HrEmptyState title={t("hr.admin.empty")} />
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">{t("hr.directory.employee")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("hr.leave.type")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("hr.admin.period")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("hr.admin.status")}</th>
                      <th className="px-4 py-3 text-right font-medium">{t("hr.admin.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((raw) => {
                      const row = raw as Record<string, unknown>;
                      const id = String(row.id);
                      const type = row.ref_absence_types as { name_ru: string; name_kk: string } | null;
                      const employee = row.employee as {
                        full_name_ru?: string;
                        full_name_kk?: string;
                        email?: string;
                      } | null;
                      const isPending = row.status === "pending";
                      return (
                        <tr key={id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {employee
                                ? localized(employee, locale, "full_name") || employee.email
                                : "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">{type ? localized(type, locale, "name") : "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fmtDateShort(String(row.date_from))} — {fmtDateShort(String(row.date_to))}
                            {row.business_days
                              ? ` · ${row.business_days} ${t("hr.leave.businessDays")}`
                              : ""}
                          </td>
                          <td className="px-4 py-3">
                            <LeaveStatusBadge status={String(row.status)} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isPending ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={decideMut.isPending}
                                  onClick={() => decideMut.mutate({ id, decision: "approved" })}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={decideMut.isPending}
                                  onClick={() => decideMut.mutate({ id, decision: "rejected" })}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="balances" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("hr.admin.balancesDescription").replace("{year}", String(year))}
            </p>
            {balancesLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : balances.length === 0 ? (
              <HrEmptyState title={t("hr.admin.balancesEmpty")} />
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">{t("hr.directory.employee")}</th>
                      <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                        {t("hr.directory.department")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">{t("hr.leave.entitled")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("hr.leave.used")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("hr.leave.remaining")}</th>
                      <th className="px-4 py-3 text-right font-medium">{t("hr.admin.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((row) => {
                      const editKey = row.user_id;
                      const editVal = editEntitled[editKey] ?? String(row.entitled_days);
                      const parsed = Number.parseInt(editVal, 10);
                      const dirty = Number.isFinite(parsed) && parsed !== row.entitled_days;
                      return (
                        <tr key={row.user_id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-medium">{localized(row, locale, "full_name")}</div>
                            <div className="text-xs text-muted-foreground">{row.email}</div>
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            {row.department ? localized(row.department, locale, "name") : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              max={365}
                              className="h-8 w-20"
                              value={editVal}
                              onChange={(e) =>
                                setEditEntitled((prev) => ({ ...prev, [editKey]: e.target.value }))
                              }
                            />
                          </td>
                          <td className="px-4 py-3">{row.used_days}</td>
                          <td className="px-4 py-3 font-medium">{row.remaining_days}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!dirty || balanceMut.isPending || !Number.isFinite(parsed)}
                              onClick={() =>
                                balanceMut.mutate({ userId: row.user_id, entitled: parsed })
                              }
                            >
                              {balanceMut.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

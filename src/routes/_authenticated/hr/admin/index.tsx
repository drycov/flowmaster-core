import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { LeaveStatusBadge } from "@/components/hr/LeaveStatusBadge";
import { useI18n, localized } from "@/i18n";
import { listOrgLeaveRequests } from "@/lib/api/hr.functions";
import { fmtDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/hr/admin/")({
  beforeLoad: () => requireModule("hr", "manage"),
  component: HrAdminPage,
});

function HrAdminPage() {
  const { t, locale } = useI18n();
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["org-leave-requests"],
    queryFn: listOrgLeaveRequests,
  });

  return (
    <>
      <PageHeader
        title={t("hr.admin.title")}
        description={t("hr.admin.description")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/leave">{t("hr.leave.backToMine")}</Link>
          </Button>
        }
      />
      <PageBody className="max-w-5xl">
        {error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : String(error)}
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("hr.admin.empty")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("hr.directory.employee")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("hr.leave.type")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("hr.admin.period")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("hr.admin.status")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((raw) => {
                  const row = raw as Record<string, unknown>;
                  const type = row.ref_absence_types as { name_ru: string; name_kk: string } | null;
                  const employee = row.employee as {
                    full_name_ru?: string;
                    full_name_kk?: string;
                    email?: string;
                  } | null;
                  return (
                    <tr key={String(row.id)} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {employee ? localized(employee, locale, "full_name") || employee.email : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {type ? localized(type, locale, "name") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {fmtDateShort(String(row.date_from))} — {fmtDateShort(String(row.date_to))}
                        {row.business_days
                          ? ` · ${row.business_days} ${t("hr.leave.businessDays")}`
                          : ""}
                      </td>
                      <td className="px-4 py-3">
                        <LeaveStatusBadge status={String(row.status)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </>
  );
}

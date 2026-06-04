import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/api/documents.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n, localized } from "@/lib/i18n";
import { fmtRel } from "@/lib/format";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import { FileText, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboardStats() });

  const stats = [
    { label: t("nav.documents"), value: data?.totalDocs ?? 0, icon: FileText, color: "text-primary" },
    { label: t("nav.tasks"), value: data?.tasksCount ?? 0, icon: Clock, color: "text-[oklch(0.5_0.15_75)]" },
    { label: t("sla.overdue"), value: data?.overdue ?? 0, icon: AlertTriangle, color: "text-destructive" },
    { label: t("nav.notifications"), value: data?.unread ?? 0, icon: CheckCircle2, color: "text-[oklch(0.5_0.14_145)]" },
  ];

  return (
    <>
      <PageHeader title={t("nav.dashboard")} description={t("app.tagline")} />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="rounded-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-8 h-8 ${s.color}`} />
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle className="text-sm">{t("nav.tasks")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(data?.tasks ?? []).length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">{t("common.empty")}</div>
              ) : (
                <table className="w-full data-table">
                  <tbody>
                    {data!.tasks.map((task) => (
                      <tr key={task.id} className="border-t border-border hover:bg-muted/50">
                        <td className="px-4 py-2.5">
                          <Link to="/documents/$id" params={{ id: task.document_id }} className="text-primary hover:underline">
                            {task.title}
                          </Link>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {task.due_at ? `${t("common.deadline")}: ${fmtRel(task.due_at, locale)}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-32 text-right">
                          <StatusBadge status={task.status} kind="status" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle className="text-sm">{t("nav.documents")} — мои</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(data?.myDocs ?? []).length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">{t("common.empty")}</div>
              ) : (
                <table className="w-full data-table">
                  <tbody>
                    {data!.myDocs.map((d) => (
                      <tr key={d.id} className="border-t border-border hover:bg-muted/50">
                        <td className="px-4 py-2.5">
                          <Link to="/documents/$id" params={{ id: d.id }} className="text-primary hover:underline">
                            {localized(d, locale, "title")}
                          </Link>
                          <div className="text-xs text-muted-foreground font-mono">{d.reg_number}</div>
                        </td>
                        <td className="px-4 py-2.5 w-24 text-right"><StatusBadge status={d.status} /></td>
                        <td className="px-4 py-2.5 w-24 text-right"><SlaBadge sla={d.sla_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

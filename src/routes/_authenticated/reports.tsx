import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis, Cell } from "recharts";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { getEdmsReports } from "@/lib/api/reports.functions";
import { useI18n, localized } from "@/i18n";
import { downloadCsv, reportsToCsv } from "@/lib/reports/export-csv";
import { Download, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: () => requireModule("reports", "read"),
  component: ReportsPage,
});

const STATUS_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(220 14% 46%)",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
];

function ReportsPage() {
  const { t, locale } = useI18n();
  const [days, setDays] = useState("30");

  const { data, isLoading } = useQuery({
    queryKey: ["edms-reports", days],
    queryFn: () => getEdmsReports({ data: { days: Number(days) } }),
  });

  const statusData =
    data?.documents_by_status.map((r) => ({
      name: t(`status.${r.status}` as never) || r.status,
      value: r.count,
      status: r.status,
    })) ?? [];

  const typeData =
    data?.documents_by_type.map((r) => ({
      name: localized(r, locale, "name"),
      count: r.count,
    })) ?? [];

  const timelineData = data?.documents_timeline ?? [];

  const summary = [
    { label: t("reports.totalDocs"), value: data?.totals.documents ?? 0 },
    { label: t("reports.createdInPeriod"), value: data?.totals.created_in_period ?? 0 },
    { label: t("reports.tasksPending"), value: data?.workflow_tasks.pending ?? 0 },
    { label: t("reports.slaOverdue"), value: data?.sla_summary.overdue ?? 0 },
    { label: t("nav.incoming"), value: data?.correspondence.incoming ?? 0 },
    { label: t("nav.outgoing"), value: data?.correspondence.outgoing ?? 0 },
  ];

  const handleExport = () => {
    if (!data) return;
    downloadCsv(`edms-report-${days}d.csv`, reportsToCsv(data, locale));
  };

  return (
    <>
      <PageHeader
        title={t("nav.reports")}
        description={t("reports.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t("reports.period7")}</SelectItem>
                <SelectItem value="30">{t("reports.period30")}</SelectItem>
                <SelectItem value="90">{t("reports.period90")}</SelectItem>
                <SelectItem value="365">{t("reports.period365")}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={!data}>
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
          </div>
        }
      />
      <PageBody className="space-y-6">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-12">{t("common.loading")}</p>
        )}

        {!isLoading && data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {summary.map((s) => (
                <Card key={s.label} className="rounded-sm">
                  <CardContent className="p-4">
                    <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="rounded-sm">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    {t("reports.byStatus")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={Object.fromEntries(
                      statusData.map((d, i) => [d.status, { label: d.name, color: STATUS_COLORS[i % STATUS_COLORS.length] }]),
                    )}
                    className="h-[280px]"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                        {statusData.map((_, i) => (
                          <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="rounded-sm">
                <CardHeader>
                  <CardTitle className="text-sm">{t("reports.byType")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{ count: { label: t("reports.count"), color: "hsl(var(--primary))" } }}
                    className="h-[280px]"
                  >
                    <BarChart data={typeData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={2} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-sm">
              <CardHeader>
                <CardTitle className="text-sm">{t("reports.timeline")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ count: { label: t("doc.new"), color: "hsl(var(--primary))" } }}
                  className="h-[300px]"
                >
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="rounded-sm">
                <CardHeader><CardTitle className="text-sm">{t("reports.sla")}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>{t("sla.ok")}</span><span>{data.sla_summary.ok}</span></div>
                  <div className="flex justify-between"><span>{t("sla.warning")}</span><span>{data.sla_summary.warning}</span></div>
                  <div className="flex justify-between text-destructive"><span>{t("sla.overdue")}</span><span>{data.sla_summary.overdue}</span></div>
                </CardContent>
              </Card>
              <Card className="rounded-sm">
                <CardHeader><CardTitle className="text-sm">{t("reports.workflow")}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>{t("status.pending")}</span><span>{data.workflow_tasks.pending}</span></div>
                  <div className="flex justify-between"><span>{t("status.completed")}</span><span>{data.workflow_tasks.completed}</span></div>
                  <div className="flex justify-between"><span>{t("reports.avgHours")}</span><span>{data.workflow_tasks.avg_completion_hours ?? "—"}</span></div>
                </CardContent>
              </Card>
              <Card className="rounded-sm">
                <CardHeader><CardTitle className="text-sm">{t("archive.title")}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>{t("archive.filterArchived")}</span><span>{data.archive.archived}</span></div>
                  <div className="flex justify-between"><span>{t("archive.legalHold")}</span><span>{data.archive.legal_hold}</span></div>
                  <div className="flex justify-between"><span>{t("archive.filterExpiring")}</span><span>{data.archive.expiring_30d}</span></div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

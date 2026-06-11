import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { requireModule } from "@/lib/access/route-guards";
import { getSystemMonitoringStatus } from "@/lib/api/monitoring.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/monitoring")({
  beforeLoad: () => requireModule("monitoring", "read"),
  component: AdminMonitoringPage,
});

function statusTone(value: string) {
  if (value === "ok" || value === "active" || value === "valid") return "text-emerald-600";
  if (value === "unknown") return "text-muted-foreground";
  return "text-destructive";
}

function AdminMonitoringPage() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["system-monitoring"],
    queryFn: () => getSystemMonitoringStatus(),
    refetchInterval: 30_000,
  });

  const data = q.data;
  const overallOk = data?.ok ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("monitoring.title")}
        description={t("monitoring.description")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", q.isFetching && "animate-spin")} />
            {t("monitoring.refresh")}
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("monitoring.health.title")}</CardTitle>
          </div>
          <CardDescription>
            {q.isLoading
              ? t("monitoring.loading")
              : overallOk
                ? t("monitoring.health.ok")
                : t("monitoring.health.degraded")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <p className="text-sm text-destructive">{t("monitoring.error")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(data?.checks ?? {}).map(([key, value]) =>
                key.endsWith("_error") ? null : (
                  <div key={key} className="rounded-lg border bg-card px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t(`monitoring.check.${key}`)}
                    </p>
                    <p className={cn("mt-1 font-medium", statusTone(value))}>{value}</p>
                    {data?.checks[`${key}_error`] ? (
                      <p className="mt-1 text-xs text-destructive">{data.checks[`${key}_error`]}</p>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={t("monitoring.metric.uptime")} value={formatUptime(data.uptime_seconds, t)} />
            <MetricCard label={t("monitoring.metric.env")} value={data.node_env} />
            <MetricCard
              label={t("monitoring.metric.sentry")}
              value={data.sentry_configured ? t("monitoring.enabled") : t("monitoring.disabled")}
            />
            <MetricCard
              label={t("monitoring.metric.checkedAt")}
              value={new Date(data.checked_at).toLocaleString()}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("monitoring.init.title")}</CardTitle>
              <CardDescription>{t("monitoring.init.description")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InitStat label={t("monitoring.init.admins")} value={String(data.init.admin_count)} />
              <InitStat
                label={t("monitoring.init.departments")}
                value={String(data.init.departments_count)}
              />
              <InitStat label={t("monitoring.init.roles")} value={String(data.init.roles_count)} />
              <InitStat
                label={t("monitoring.init.setup")}
                value={data.init.needs_setup ? t("monitoring.init.required") : t("monitoring.init.done")}
                warn={data.init.needs_setup}
              />
            </CardContent>
          </Card>

          {data.grafana_url ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("monitoring.grafana.title")}</CardTitle>
                <CardDescription>{t("monitoring.grafana.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <a href={data.grafana_url} target="_blank" rel="noreferrer">
                    {t("monitoring.grafana.open")}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function InitStat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-medium", warn && "text-amber-600")}>{value}</p>
    </div>
  );
}

function formatUptime(seconds: number, t: (key: string) => string) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}${t("monitoring.uptime.days")} ${hours}${t("monitoring.uptime.hours")}`;
  if (hours > 0) return `${hours}${t("monitoring.uptime.hours")} ${minutes}${t("monitoring.uptime.minutes")}`;
  return `${minutes}${t("monitoring.uptime.minutes")}`;
}

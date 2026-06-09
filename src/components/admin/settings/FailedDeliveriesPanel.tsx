import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import {
  getOutboxStats,
  listFailedDeliveries,
  retryFailedDelivery,
  type OutboxChannel,
} from "@/lib/api/outbox.functions";
import { fmtDate } from "@/lib/format";

function channelLabel(t: (key: string) => string, channel: OutboxChannel): string {
  if (channel === "email") return t("deliveries.channelEmail");
  if (channel === "telegram") return t("deliveries.channelTelegram");
  return t("deliveries.channelWebhook");
}

export function FailedDeliveriesPanel() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["outbox-stats"],
    queryFn: getOutboxStats,
    refetchInterval: 60_000,
  });

  const { data: failed = [], isLoading } = useQuery({
    queryKey: ["failed-deliveries"],
    queryFn: listFailedDeliveries,
  });

  const retryMutation = useMutation({
    mutationFn: (args: { channel: OutboxChannel; id: string }) =>
      retryFailedDelivery({ data: args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["failed-deliveries"] });
      qc.invalidateQueries({ queryKey: ["outbox-stats"] });
      toast.success(t("deliveries.retryQueued"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalFailed =
    (stats?.email_failed ?? 0) + (stats?.telegram_failed ?? 0) + (stats?.webhook_failed ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4" />
          {t("deliveries.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats ? (
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-md border p-2">
              <p className="font-medium">{t("deliveries.channelEmail")}</p>
              <p className="text-muted-foreground">
                {t("deliveries.pending")}: {stats.email_pending} · {t("deliveries.failed")}:{" "}
                {stats.email_failed}
              </p>
            </div>
            <div className="rounded-md border p-2">
              <p className="font-medium">{t("deliveries.channelTelegram")}</p>
              <p className="text-muted-foreground">
                {t("deliveries.pending")}: {stats.telegram_pending} · {t("deliveries.failed")}:{" "}
                {stats.telegram_failed}
              </p>
            </div>
            <div className="rounded-md border p-2">
              <p className="font-medium">{t("deliveries.channelWebhook")}</p>
              <p className="text-muted-foreground">
                {t("deliveries.pending")}: {stats.webhook_pending} · {t("deliveries.failed")}:{" "}
                {stats.webhook_failed}
              </p>
            </div>
          </div>
        ) : null}

        {totalFailed === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">{t("deliveries.none")}</p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.loading")}
          </div>
        ) : null}

        {failed.length > 0 ? (
          <div className="space-y-2">
            {failed.map((row) => (
              <div
                key={`${row.channel}-${row.id}`}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{channelLabel(t, row.channel)}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {fmtDate(row.created_at, locale)}
                    </span>
                  </div>
                  <p className="font-medium break-all">{row.destination}</p>
                  {row.subject ? (
                    <p className="text-muted-foreground break-all">{row.subject}</p>
                  ) : null}
                  {row.last_error ? (
                    <p className="text-xs text-destructive break-all">{row.last_error}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {t("deliveries.attempts")}: {row.attempts}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retryMutation.isPending}
                  onClick={() => retryMutation.mutate({ channel: row.channel, id: row.id })}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  {t("deliveries.retry")}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

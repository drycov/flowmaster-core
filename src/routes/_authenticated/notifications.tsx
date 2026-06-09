import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotifications, markNotificationsRead } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { ListEmpty, PanelCard } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { fmtRel } from "@/lib/format";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notif"],
    queryFn: () => listNotifications(),
  });

  const mark = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const items = data ?? [];

  return (
    <>
      <PageHeader
        title={t("nav.notifications")}
        actions={
          items.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => mark.mutate()} disabled={mark.isPending}>
              <Check className="w-4 h-4 mr-1" />
              {t("notifications.markAllRead")}
            </Button>
          ) : undefined
        }
      />
      <PageBody className="max-w-3xl">
        <PanelCard>
          {isLoading && <ListEmpty>{t("common.loading")}</ListEmpty>}
          {!isLoading && items.length === 0 && <ListEmpty>{t("common.empty")}</ListEmpty>}
          {!isLoading &&
            items.map((n, i) => (
              <div
                key={n.id}
                className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""} ${
                  n.read_at ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{n.title}</div>
                    {n.body && (
                      <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>
                    )}
                    {n.link && (
                      <a href={n.link} className="text-xs text-primary hover:underline">
                        {t("notifications.goTo")}
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {fmtRel(n.created_at, locale)}
                  </div>
                </div>
              </div>
            ))}
        </PanelCard>
      </PageBody>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotifications, markNotificationsRead } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { fmtRel } from "@/lib/format";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notif"], queryFn: () => listNotifications() });
  const mark = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notif"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  return (
    <>
      <PageHeader
        title={t("nav.notifications")}
        actions={<Button size="sm" variant="outline" onClick={() => mark.mutate()}><Check className="w-4 h-4 mr-1" />Прочитать все</Button>}
      />
      <PageBody>
        <div className="space-y-2 max-w-3xl">
          {(data ?? []).length === 0 && <div className="text-sm text-muted-foreground text-center py-8">{t("common.empty")}</div>}
          {(data ?? []).map((n) => (
            <div key={n.id} className={`border border-border rounded-sm p-3 ${n.read_at ? "bg-card opacity-60" : "bg-card"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
                  {n.link && <a href={n.link} className="text-xs text-primary hover:underline">Перейти</a>}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{fmtRel(n.created_at, locale)}</div>
              </div>
            </div>
          ))}
        </div>
      </PageBody>
    </>
  );
}

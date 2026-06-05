import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAuditLogs, getMyProfile } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  beforeLoad: async () => {
    const data = await getMyProfile();
    const isAdmin = data.roles.includes("admin");
    const canViewAudit = data.permissions["view_audit"];
    if (!isAdmin && !canViewAudit) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuditPage,
});

function AuditPage() {
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ["audit"], queryFn: () => listAuditLogs({ data: { limit: 200 } }) });

  return (
    <>
      <PageHeader title={t("nav.audit")} description="Неизменяемый журнал всех операций" />
      <PageBody>
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <table className="w-full data-table">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2 w-44">{t("common.date")}</th>
              <th className="text-left px-4 py-2 w-32">Сущность</th>
              <th className="text-left px-4 py-2 w-24">Действие</th>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2 w-44">Пользователь</th>
            </tr></thead>
            <tbody>
              {(data ?? []).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("common.empty")}</td></tr>}
              {(data ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{fmtDate(a.created_at, locale)}</td>
                  <td className="px-4 py-2 text-xs uppercase tracking-wider">{a.entity_type}</td>
                  <td className="px-4 py-2 text-xs font-mono">{a.action}</td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground truncate max-w-xs">{a.entity_id}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{a.actor_id?.slice(0, 8) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}

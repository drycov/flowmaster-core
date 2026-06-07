import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listAuditLogs, getMyProfile } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ENTITY_TYPES = [
  "all",
  "organization",
  "departments",
  "positions",
  "role_definitions",
  "roles",
  "role_permissions",
  "user_role_grants",
  "user_roles",
  "profile_assignments",
  "workflows",
  "document_templates",
  "document",
];

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
  const [entityType, setEntityType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const { data } = useQuery({
    queryKey: ["audit", entityType],
    queryFn: () =>
      listAuditLogs({
        data: {
          entity_type: entityType === "all" ? undefined : entityType,
          limit: 300,
        },
      }),
  });

  const filtered = (data ?? []).filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.entity_id?.toLowerCase().includes(s) ||
      a.actor_id?.toLowerCase().includes(s) ||
      a.action?.toLowerCase().includes(s)
    );
  });

  return (
    <>
      <PageHeader
        title={t("nav.audit")}
        description="Неизменяемый журнал всех операций"
      />
      <PageBody>
        <div className="flex flex-wrap gap-3 mb-4">
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e === "all" ? "Все сущности" : e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Поиск по ID / actor / действию…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="text-xs text-muted-foreground self-center">
            Записей: {filtered.length}
          </div>
        </div>

        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2 w-44">{t("common.date")}</th>
                <th className="text-left px-4 py-2 w-44">Сущность</th>
                <th className="text-left px-4 py-2 w-24">Действие</th>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2 w-32">Пользователь</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {t("common.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {fmtDate(a.created_at, locale)}
                  </td>
                  <td className="px-4 py-2 text-xs uppercase tracking-wider">
                    {a.entity_type}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono">{a.action}</td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground truncate max-w-xs">
                    {a.entity_id}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                    {a.actor_id?.slice(0, 8) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}

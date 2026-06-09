import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { listAuditLogs } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import {
  DataTableShell,
  PageToolbar,
  SearchField,
  TableStatusRow,
} from "@/components/PageLayout";
import { useI18n, auditEntityLabel, auditActionLabel } from "@/i18n";
import { fmtDate } from "@/lib/format";
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
  "profiles",
  "workflows",
  "document_templates",
  "document",
  "workflow_task",
];

export const Route = createFileRoute("/_authenticated/audit")({
  beforeLoad: () => requireModule("audit"),
  component: AuditPage,
});

function AuditPage() {
  const { t, locale } = useI18n();
  const [entityType, setEntityType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    const actorName = (a as any).actor?.full_name_ru ?? "";
    const actorEmail = (a as any).actor?.email ?? "";
    return (
      a.entity_id?.toLowerCase().includes(s) ||
      a.actor_id?.toLowerCase().includes(s) ||
      a.action?.toLowerCase().includes(s) ||
      actorName.toLowerCase().includes(s) ||
      actorEmail.toLowerCase().includes(s)
    );
  });

  return (
    <>
      <PageHeader title={t("nav.audit")} description={t("audit.description")} />
      <PageBody>
        <PageToolbar>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-64 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e === "all" ? t("audit.allEntities") : auditEntityLabel(t, e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("audit.searchPlaceholder")}
            clearable
          />
          <div className="text-xs text-muted-foreground self-center">
            {t("audit.records")}: {filtered.length}
          </div>
        </PageToolbar>

        <DataTableShell>
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2 w-44">{t("common.date")}</th>
                <th className="text-left px-4 py-2 w-40">{t("audit.entity")}</th>
                <th className="text-left px-4 py-2 w-28">{t("audit.action")}</th>
                <th className="text-left px-4 py-2 w-48">{t("audit.actor")}</th>
                <th className="text-left px-4 py-2">{t("audit.details")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <TableStatusRow colSpan={5}>{t("common.empty")}</TableStatusRow>
              )}
              {filtered.map((a) => {
                const actor = (a as any).actor as
                  | { full_name_ru: string | null; email: string }
                  | null
                  | undefined;
                const isExpanded = expandedId === a.id;
                return (
                  <Fragment key={a.id}>
                    <tr
                      className="border-t border-border align-top cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    >
                      <td className="px-4 py-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {fmtDate(a.created_at, locale)}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {auditEntityLabel(t, a.entity_type)}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <Badge
                          variant={
                            a.action?.startsWith("workflow.sla") ? "destructive" : "outline"
                          }
                          className="font-mono text-[10px]"
                        >
                          {auditActionLabel(t, a.action) !== a.action
                            ? auditActionLabel(t, a.action)
                            : a.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {actor ? (
                          <div>
                            <div className="font-medium">{actor.full_name_ru || actor.email}</div>
                            {actor.full_name_ru && (
                              <div className="text-muted-foreground">{actor.email}</div>
                            )}
                          </div>
                        ) : a.actor_id ? (
                          <span className="font-mono text-muted-foreground">
                            {a.actor_id.slice(0, 8)}…
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{t("audit.system")}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground font-mono truncate max-w-xs">
                        {a.entity_id}
                        {a.correlation_id && (
                          <span className="block text-[10px] mt-0.5">
                            corr: {a.correlation_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-border bg-muted/20">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid md:grid-cols-2 gap-3 text-xs">
                            {a.before && (
                              <div>
                                <div className="font-medium mb-1 text-muted-foreground">{t("audit.diff.before")}</div>
                                <pre className="bg-background border rounded-sm p-2 overflow-auto max-h-48 text-[10px]">
                                  {JSON.stringify(a.before, null, 2)}
                                </pre>
                              </div>
                            )}
                            {a.after && (
                              <div>
                                <div className="font-medium mb-1 text-muted-foreground">{t("audit.diff.after")}</div>
                                <pre className="bg-background border rounded-sm p-2 overflow-auto max-h-48 text-[10px]">
                                  {JSON.stringify(a.after, null, 2)}
                                </pre>
                              </div>
                            )}
                            {!a.before && !a.after && (
                              <div className="text-muted-foreground">{t("audit.noDiff")}</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      </PageBody>
    </>
  );
}

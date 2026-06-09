import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listDocuments } from "@/lib/api/documents.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { DataTableShell, PageToolbar, TableStatusRow } from "@/components/PageLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/archive")({
  beforeLoad: () => requireModule("archive"),
  component: ArchivePage,
});

type ArchiveFilter = "all" | "archived" | "expiring" | "legal_hold";

function ArchivePage() {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<ArchiveFilter>("archived");

  const queryParams = (() => {
    if (filter === "expiring") {
      return { retention_expiring: true, limit: 200 };
    }
    if (filter === "legal_hold") {
      return { legal_hold_only: true, limit: 200 };
    }
    if (filter === "archived") {
      return { scope: "archive" as const, limit: 200 };
    }
    return { limit: 200 };
  })();

  const { data, isLoading } = useQuery({
    queryKey: ["arch", filter],
    queryFn: () => listDocuments({ data: queryParams }),
  });

  const rows = (data ?? []) as Array<{
    id: string;
    reg_number: string;
    title_ru: string;
    title_kk?: string | null;
    status: string;
    created_at: string;
    archived_at?: string | null;
    retention_due_at?: string | null;
    legal_hold?: boolean;
  }>;

  return (
    <>
      <PageHeader title={t("nav.archive")} />
      <PageBody>
        <PageToolbar>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["archived", t("archive.filterArchived")],
                ["expiring", t("archive.filterExpiring")],
                ["legal_hold", t("archive.filterLegalHold")],
                ["all", t("common.all")],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </PageToolbar>

        <DataTableShell>
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2 w-32">{t("doc.regNumber")}</th>
                <th className="text-left px-4 py-2">{t("common.title")}</th>
                <th className="text-left px-4 py-2 w-28">{t("common.status")}</th>
                <th className="text-left px-4 py-2 w-32">{t("archive.retentionDue")}</th>
                <th className="text-left px-4 py-2 w-32">{t("archive.archivedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <TableStatusRow colSpan={5}>{t("common.loading")}</TableStatusRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableStatusRow colSpan={5}>{t("common.empty")}</TableStatusRow>
              )}
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2 font-mono text-xs">{d.reg_number}</td>
                  <td className="px-4 py-2">
                    <Link
                      to="/documents/$id"
                      params={{ id: d.id }}
                      className="text-primary hover:underline"
                    >
                      {localized(d, locale, "title")}
                    </Link>
                    {d.legal_hold && (
                      <Badge variant="outline" className="ml-2 text-amber-700 border-amber-500/50">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Hold
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {d.retention_due_at ? fmtDateShort(d.retention_due_at, locale) : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                    {d.archived_at ? fmtDateShort(d.archived_at, locale) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      </PageBody>
    </>
  );
}

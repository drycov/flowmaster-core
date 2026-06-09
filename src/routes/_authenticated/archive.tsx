import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDocuments } from "@/lib/api/documents.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { DataTableShell, TableStatusRow } from "@/components/PageLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/archive")({
  component: ArchivePage,
});

function ArchivePage() {
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ["arch"], queryFn: () => listDocuments({ data: { scope: "archive" } }) });

  return (
    <>
      <PageHeader title={t("nav.archive")} />
      <PageBody>
        <DataTableShell>
          <table className="w-full data-table">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2 w-32">{t("doc.regNumber")}</th>
              <th className="text-left px-4 py-2">{t("common.title")}</th>
              <th className="text-left px-4 py-2 w-32">{t("common.status")}</th>
              <th className="text-left px-4 py-2 w-32">{t("common.date")}</th>
            </tr></thead>
            <tbody>
              {(data ?? []).length === 0 && (
                <TableStatusRow colSpan={4}>{t("common.empty")}</TableStatusRow>
              )}
              {(data ?? []).map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2 font-mono text-xs">{d.reg_number}</td>
                  <td className="px-4 py-2"><Link to="/documents/$id" params={{ id: d.id }} className="text-primary hover:underline">{localized(d, locale, "title")}</Link></td>
                  <td className="px-4 py-2"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">{fmtDateShort(d.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      </PageBody>
    </>
  );
}

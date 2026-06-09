import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Plus } from "lucide-react";
import { listDocuments } from "@/lib/api/documents.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { DataTableShell, PageToolbar, SearchField, TableStatusRow } from "@/components/PageLayout";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";

type CorrespondenceKind = "incoming" | "outgoing";

export function createCorrespondenceRoute(kind: CorrespondenceKind) {
  const path = kind === "incoming" ? "/correspondence/incoming" : "/correspondence/outgoing";

  return createFileRoute(`/_authenticated${path}`)({
    component: () => <CorrespondenceJournalPage kind={kind} />,
  });
}

function CorrespondenceJournalPage({ kind }: { kind: CorrespondenceKind }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const titleKey = kind === "incoming" ? "corr.incoming" : "corr.outgoing";
  const dateKey = kind === "incoming" ? "doc.receivedAt" : "doc.sentAt";
  const dateField = kind === "incoming" ? "received_at" : "sent_at";

  const { data, isLoading } = useQuery({
    queryKey: ["correspondence", kind, { search: deferredSearch }],
    queryFn: () =>
      listDocuments({
        data: {
          document_type_code: kind,
          search: deferredSearch || undefined,
          limit: 100,
        },
      }),
  });

  const rows = (data ?? []) as any[];

  return (
    <>
      <PageHeader
        title={t(titleKey)}
        actions={
          <Button onClick={() => navigate({ to: "/documents/new" })} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            {t("doc.new")}
          </Button>
        }
      />
      <PageBody>
        <PageToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("common.search")}
          />
        </PageToolbar>

        <DataTableShell>
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2 w-48">{t("doc.regNumber")}</th>
                <th className="text-left px-4 py-2 w-40">{t("doc.externalRegNumber")}</th>
                <th className="text-left px-4 py-2">{t("common.title")}</th>
                <th className="text-left px-4 py-2 w-40">{t(dateKey)}</th>
                <th className="text-left px-4 py-2 w-40">{t("common.status")}</th>
                <th className="text-left px-4 py-2 w-24">SLA</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <TableStatusRow colSpan={6}>{t("common.loading")}</TableStatusRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableStatusRow colSpan={6}>{t("common.empty")}</TableStatusRow>
              )}
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link
                      to="/documents/$id"
                      params={{ id: d.id }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {d.reg_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {d.external_reg_number || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm">{localized(d, locale, "title")}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {fmtDateShort(d[dateField] ?? d.created_at, locale)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-2">
                    <SlaBadge sla={d.sla_status ?? "ok"} />
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

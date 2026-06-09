import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTableShell, TableStatusRow } from "@/components/PageLayout";
import { useI18n, localized } from "@/i18n";
import { listContracts } from "@/lib/api/contracts.functions";
import { fmtDateShort } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/contracts/")({
  beforeLoad: () => requireModule("contracts"),
  component: ContractsPage,
});

function ContractsPage() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [expiring, setExpiring] = useState(false);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", search, status, expiring],
    queryFn: () =>
      listContracts({
        data: {
          search: search || undefined,
          contract_status: status === "all" ? undefined : status,
          expiring_within_days: expiring ? 30 : undefined,
        },
      }),
  });

  return (
    <>
      <PageHeader title={t("contract.pageTitle")} description={t("contract.pageSubtitle")} />
      <PageBody>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {["draft", "negotiation", "active", "expired", "terminated"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`contract.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              variant={expiring ? "default" : "outline"}
              className="cursor-pointer h-9 px-3 flex items-center"
              onClick={() => setExpiring((v) => !v)}
            >
              {t("contract.expiring30")}
            </Badge>
          </div>

          <DataTableShell>
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left">{t("contract.number")}</th>
                  <th className="px-4 py-2 text-left">{t("common.title")}</th>
                  <th className="px-4 py-2 text-left">{t("doc.correspondent")}</th>
                  <th className="px-4 py-2 text-left">{t("contract.validity")}</th>
                  <th className="px-4 py-2 text-left">{t("contract.amount")}</th>
                  <th className="px-4 py-2 text-left">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <TableStatusRow colSpan={6}>{t("common.loading")}</TableStatusRow>
                )}
                {!isLoading && contracts.length === 0 && (
                  <TableStatusRow colSpan={6}>{t("common.empty")}</TableStatusRow>
                )}
                {!isLoading &&
                  contracts.map((c: {
                    document_id: string;
                    contract_number: string;
                    contract_status: string;
                    valid_from: string | null;
                    valid_to: string | null;
                    amount: number | null;
                    currency: string;
                    documents?: { id: string; reg_number: string; title_ru: string; title_kk: string } | null;
                    ref_correspondents?: { name_ru: string; name_kk: string } | null;
                  }) => {
                    const doc = c.documents;
                    return (
                      <tr key={c.document_id} className="border-t border-border hover:bg-muted/40">
                        <td className="px-4 py-2 font-mono text-xs">
                          <Link
                            to="/contracts/$documentId"
                            params={{ documentId: c.document_id }}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <ScrollText className="w-3 h-3" />
                            {c.contract_number || doc?.reg_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {doc ? localized(doc, locale, "title") : "—"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {c.ref_correspondents
                            ? localized(c.ref_correspondents, locale, "name")
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {c.valid_from ? fmtDateShort(c.valid_from, locale) : "…"} —{" "}
                          {c.valid_to ? fmtDateShort(c.valid_to, locale) : "…"}
                        </td>
                        <td className="px-4 py-2 text-sm tabular-nums">
                          {c.amount != null
                            ? `${c.amount.toLocaleString(locale === "kk" ? "kk-KZ" : "ru-RU")} ${c.currency}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {t(`contract.status.${c.contract_status}`)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </DataTableShell>
        </div>
      </PageBody>
    </>
  );
}

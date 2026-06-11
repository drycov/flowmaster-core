import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Building2 } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ManageCatalogLink } from "@/components/references/ManageCatalogLink";
import { DataTableShell, TableStatusRow } from "@/components/PageLayout";
import { useI18n, localized } from "@/i18n";
import { listCounterparties } from "@/lib/api/counterparties.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/counterparties/")({
  beforeLoad: () => requireModule("counterparties"),
  component: CounterpartiesPage,
});

function CounterpartiesPage() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["counterparties", search, type],
    queryFn: () =>
      listCounterparties({
        data: {
          search: search || undefined,
          correspondent_type: type === "all" ? undefined : (type as never),
        },
      }),
  });

  return (
    <>
      <PageHeader
        title={t("counterparty.pageTitle")}
        description={t("counterparty.pageSubtitle")}
      />
      <PageBody>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-xs"
                placeholder={t("counterparty.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="legal">{t("counterparty.type.legal")}</SelectItem>
                  <SelectItem value="individual">{t("counterparty.type.individual")}</SelectItem>
                  <SelectItem value="government">{t("counterparty.type.government")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ManageCatalogLink catalogId="correspondents" labelKey="counterparty.manageRefs" />
          </div>

          <DataTableShell>
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left">{t("common.code")}</th>
                  <th className="px-4 py-2 text-left">{t("common.title")}</th>
                  <th className="px-4 py-2 text-left">{t("counterparty.type")}</th>
                  <th className="px-4 py-2 text-left">БИН</th>
                  <th className="px-4 py-2 text-left">{t("common.contact")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableStatusRow colSpan={5}>{t("common.loading")}</TableStatusRow>}
                {!isLoading && rows.length === 0 && (
                  <TableStatusRow colSpan={5}>{t("common.empty")}</TableStatusRow>
                )}
                {!isLoading &&
                  rows.map(
                    (r: {
                      id: string;
                      code: string;
                      name_ru: string;
                      name_kk: string;
                      correspondent_type?: string;
                      bin?: string;
                      contact_person?: string;
                      phone?: string;
                    }) => (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                        <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                        <td className="px-4 py-2">
                          <Link
                            to="/counterparties/$id"
                            params={{ id: r.id }}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Building2 className="w-3 h-3" />
                            {localized(r, locale, "name")}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {t(`counterparty.type.${r.correspondent_type ?? "legal"}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{r.bin || "—"}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {r.contact_person || r.phone || "—"}
                        </td>
                      </tr>
                    ),
                  )}
              </tbody>
            </table>
          </DataTableShell>
        </div>
      </PageBody>
    </>
  );
}

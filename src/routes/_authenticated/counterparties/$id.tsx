import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n, localized } from "@/i18n";
import { getCounterparty } from "@/lib/api/counterparties.functions";
import { fmtDateShort } from "@/lib/format";
import { Building2, ScrollText, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/counterparties/$id")({
  beforeLoad: () => requireModule("counterparties"),
  component: CounterpartyDetailPage,
});

function CounterpartyDetailPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["counterparty", id],
    queryFn: () => getCounterparty({ data: { id } }),
  });

  if (isLoading) return <PageBody>{t("common.loading")}</PageBody>;
  if (!data) return <PageBody>{t("errors.notFound.description")}</PageBody>;

  const contracts = (data.contracts ?? []) as unknown as Array<{
    document_id: string;
    contract_number: string;
    contract_status: string;
    valid_to: string | null;
    amount: number | null;
    currency: string;
    documents?: { reg_number: string; title_ru: string; title_kk?: string | null };
  }>;

  const documents = (data.documents ?? []) as Array<{
    id: string;
    reg_number: string;
    title_ru: string;
    title_kk: string;
    status: string;
  }>;

  return (
    <>
      <PageHeader
        title={localized(data, locale, "name")}
        description={`${data.code}${data.bin ? ` · БИН ${data.bin}` : ""}`}
      />
      <PageBody>
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {t("counterparty.card")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{t("counterparty.type")}</div>
                <Badge variant="outline">
                  {t(`counterparty.type.${data.correspondent_type ?? "legal"}`)}
                </Badge>
              </div>
              {data.contact_person && (
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("counterparty.contactPerson")}
                  </div>
                  {data.contact_person}
                </div>
              )}
              {data.phone && (
                <div>
                  <div className="text-xs text-muted-foreground">{t("common.phone")}</div>
                  {data.phone}
                </div>
              )}
              {data.email && (
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  {data.email}
                </div>
              )}
              {data.address_ru && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground">{t("counterparty.address")}</div>
                  {locale === "kk" && data.address_kk ? data.address_kk : data.address_ru}
                </div>
              )}
              {(data.bank_name || data.bank_account) && (
                <div className="sm:col-span-2 border-t pt-3">
                  <div className="text-xs text-muted-foreground mb-1">{t("counterparty.bank")}</div>
                  {data.bank_name && <div>{data.bank_name}</div>}
                  {data.iik && <div className="font-mono text-xs">ИИК: {data.iik}</div>}
                  {data.bik && <div className="font-mono text-xs">БИК: {data.bik}</div>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ScrollText className="w-4 h-4" />
                {t("contract.pageTitle")} ({contracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
              ) : (
                contracts.map((c) => (
                  <Link
                    key={c.document_id}
                    to="/documents/$id"
                    params={{ id: c.document_id }}
                    className="block border rounded-sm px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <span className="font-mono text-xs mr-2">{c.contract_number}</span>
                    {c.documents ? localized(c.documents, locale, "title") : ""}
                    <span className="text-xs text-muted-foreground ml-2">
                      {t(`contract.status.${c.contract_status}`)}
                      {c.valid_to ? ` · ${fmtDateShort(c.valid_to, locale)}` : ""}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t("nav.documents")} ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
              ) : (
                documents.map((d) => (
                  <Link
                    key={d.id}
                    to="/documents/$id"
                    params={{ id: d.id }}
                    className="block border rounded-sm px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <span className="font-mono text-xs mr-2">{d.reg_number}</span>
                    {localized(d, locale, "title")}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

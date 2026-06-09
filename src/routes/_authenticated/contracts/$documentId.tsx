import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContractDetailsCard } from "@/components/contracts/ContractDetailsCard";
import { useI18n, localized } from "@/i18n";
import { getMyProfile } from "@/lib/api/admin.functions";
import { getContractDetails } from "@/lib/api/contracts.functions";

export const Route = createFileRoute("/_authenticated/contracts/$documentId")({
  beforeLoad: () => requireModule("contracts"),
  component: ContractDetailPage,
});

function ContractDetailPage() {
  const { documentId } = Route.useParams();
  const { t, locale } = useI18n();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMyProfile });
  const canEdit = !!me?.permissions?.manage_contracts || !!me?.permissions?.manage_documents;

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", documentId],
    queryFn: () => getContractDetails({ data: { document_id: documentId } }),
  });

  const doc = contract?.documents as {
    id: string;
    reg_number: string;
    title_ru: string;
    title_kk: string;
    status: string;
  } | null;

  if (isLoading) {
    return <PageBody>{t("common.loading")}</PageBody>;
  }

  return (
    <>
      <PageHeader
        title={contract?.contract_number || doc?.reg_number || t("contract.detailTitle")}
        description={doc ? localized(doc, locale, "title") : t("contract.pageSubtitle")}
        actions={
          doc ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/documents/$id" params={{ id: doc.id }}>
                <ExternalLink className="w-4 h-4 mr-1" />
                {t("contract.openDocument")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <div className="max-w-2xl mx-auto space-y-4">
          {contract?.contract_status ? (
            <Badge variant="secondary">{t(`contract.status.${contract.contract_status}`)}</Badge>
          ) : null}
          <ContractDetailsCard documentId={documentId} contract={contract ?? null} canEdit={canEdit} />
        </div>
      </PageBody>
    </>
  );
}

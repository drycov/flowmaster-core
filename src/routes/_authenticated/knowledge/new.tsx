import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/AppShell";
import { KbArticleEditor } from "@/components/kb/KbArticleEditor";
import { KbBackLink } from "@/components/kb/KbBackLink";
import { useI18n } from "@/i18n";
import { requireModule } from "@/lib/access/route-guards";

export const Route = createFileRoute("/_authenticated/knowledge/new")({
  beforeLoad: () => requireModule("knowledge_base", "write"),
  component: KbNewArticlePage,
});

function KbNewArticlePage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("kb.newArticle")} />
      <PageBody className="max-w-3xl space-y-4">
        <KbBackLink />
        <KbArticleEditor />
      </PageBody>
    </>
  );
}

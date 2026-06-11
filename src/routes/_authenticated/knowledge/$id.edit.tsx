import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { PageHeader, PageBody } from "@/components/AppShell";
import { KbArticleEditor } from "@/components/kb/KbArticleEditor";
import { KbBackLink } from "@/components/kb/KbBackLink";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/knowledge/$id/edit")({
  beforeLoad: () => requireModule("knowledge_base", "write"),
  component: KbEditArticlePage,
});

function KbEditArticlePage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("kb.editArticle")} />
      <PageBody className="max-w-3xl space-y-4">
        <KbBackLink />
        <KbArticleEditor articleId={id} />
      </PageBody>
    </>
  );
}

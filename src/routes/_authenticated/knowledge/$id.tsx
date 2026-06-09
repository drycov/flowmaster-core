import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/i18n";
import { getKbArticle } from "@/lib/api/kb.functions";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/knowledge/$id")({
  beforeLoad: () => requireModule("knowledge_base"),
  component: KbArticlePage,
});

function KbArticlePage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();

  const { data: article, isLoading } = useQuery({
    queryKey: ["kb-article", id],
    queryFn: () => getKbArticle({ data: { id } }),
  });

  if (isLoading) return <PageBody>{t("common.loading")}</PageBody>;
  if (!article) return <PageBody>{t("errors.notFound.description")}</PageBody>;

  const doc = article.documents as { id: string; reg_number: string; title_ru: string } | null;
  const body = localized(article, locale, "body");

  return (
    <>
      <PageHeader title={localized(article, locale, "title")} />
      <PageBody>
        <div className="max-w-3xl mx-auto space-y-4">
          {article.kb_categories && (
            <Badge variant="secondary">
              {localized(
                article.kb_categories as { name_ru: string; name_kk: string },
                locale,
                "name",
              )}
            </Badge>
          )}
          {localized(article, locale, "summary") && (
            <p className="text-muted-foreground">{localized(article, locale, "summary")}</p>
          )}
          {doc && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/documents/$id" params={{ id: doc.id }}>
                <ExternalLink className="w-3 h-3 mr-1" />
                {t("kb.sourceDoc")}: {doc.reg_number}
              </Link>
            </Button>
          )}
          <article className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap border rounded-sm p-4 bg-card">
            {body || t("kb.noBody")}
          </article>
        </div>
      </PageBody>
    </>
  );
}

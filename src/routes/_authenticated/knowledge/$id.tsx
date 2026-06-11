import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Pencil } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { PageLoading } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KbBackLink } from "@/components/kb/KbBackLink";
import { useI18n, localized } from "@/i18n";
import { useAccessContext } from "@/lib/access/hooks";
import { getKbArticle } from "@/lib/api/kb.functions";

export const Route = createFileRoute("/_authenticated/knowledge/$id")({
  beforeLoad: () => requireModule("knowledge_base"),
  component: KbArticlePage,
});

function KbArticlePage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const { canModule } = useAccessContext();
  const canManage = canModule("knowledge_base", "write");

  const { data: article, isLoading } = useQuery({
    queryKey: ["kb-article", id],
    queryFn: () => getKbArticle({ data: { id } }),
  });

  if (isLoading) {
    return (
      <PageBody>
        <PageLoading label={t("common.loading")} />
      </PageBody>
    );
  }

  if (!article) {
    return (
      <PageBody>
        <KbBackLink className="mb-4" />
        <p className="text-sm text-muted-foreground">{t("errors.notFound.description")}</p>
      </PageBody>
    );
  }

  const doc = article.documents as { id: string; reg_number: string; title_ru: string } | null;
  const body = localized(article, locale, "body");
  const summary = localized(article, locale, "summary");
  const publishedAt = article.published_at
    ? new Date(article.published_at as string).toLocaleDateString(
        locale === "kk" ? "kk-KZ" : "ru-RU",
        { day: "numeric", month: "long", year: "numeric" },
      )
    : null;

  return (
    <>
      <PageHeader
        title={localized(article, locale, "title")}
        actions={
          canManage ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/knowledge/$id/edit" params={{ id }}>
                <Pencil className="w-4 h-4 mr-1" />
                {t("kb.edit")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <PageBody className="max-w-3xl">
        <KbBackLink className="mb-6" />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {article.kb_categories && (
              <Badge variant="secondary">
                {localized(
                  article.kb_categories as { name_ru: string; name_kk: string },
                  locale,
                  "name",
                )}
              </Badge>
            )}
            {publishedAt && (
              <span className="text-xs text-muted-foreground">{publishedAt}</span>
            )}
            {(article.tags as string[] | undefined)?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                {tag}
              </Badge>
            ))}
          </div>

          {summary && <p className="text-muted-foreground leading-relaxed">{summary}</p>}

          {doc && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/documents/$id" params={{ id: doc.id }}>
                <ExternalLink className="w-3 h-3 mr-1" />
                {t("kb.sourceDoc")}: {doc.reg_number}
              </Link>
            </Button>
          )}

          <article className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg bg-card p-6">
            {body || t("kb.noBody")}
          </article>
        </div>
      </PageBody>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { PageToolbar, SearchField, PageLoading } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { KbArticleCard, type KbArticleListItem } from "@/components/kb/KbArticleCard";
import { KbCategoryFilters } from "@/components/kb/KbCategoryFilters";
import { KbEmptyState } from "@/components/kb/KbEmptyState";
import { useI18n } from "@/i18n";
import { useAccessContext } from "@/lib/access/hooks";
import { listKbArticles, listKbCategories } from "@/lib/api/kb.functions";

export const Route = createFileRoute("/_authenticated/knowledge/")({
  beforeLoad: () => requireModule("knowledge_base"),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const { canModule } = useAccessContext();
  const canManage = canModule("knowledge_base", "write");

  const { data: categories = [] } = useQuery({
    queryKey: ["kb-categories"],
    queryFn: listKbCategories,
  });

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["kb-articles", search, categoryId],
    queryFn: () =>
      listKbArticles({
        data: {
          search: search || undefined,
          category_id: categoryId ?? undefined,
          status: "published",
        },
      }),
  });

  return (
    <>
      <PageHeader
        title={t("kb.pageTitle")}
        description={t("kb.pageSubtitle")}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to="/knowledge/manage">
                  <Settings2 className="w-4 h-4 mr-1" />
                  {t("kb.manage")}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/knowledge/new">
                  <Plus className="w-4 h-4 mr-1" />
                  {t("kb.newArticle")}
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />
      <PageBody className="max-w-4xl">
        <PageToolbar className="mb-4">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("kb.search")}
            className="max-w-none flex-1 min-w-[220px]"
            clearable
          />
        </PageToolbar>

        {categories.length > 0 && (
          <KbCategoryFilters
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
        )}

        <div className="mt-6 space-y-3">
          {isLoading && <PageLoading label={t("common.loading")} />}
          {!isLoading && articles.length === 0 && <KbEmptyState canManage={canManage} />}
          {!isLoading &&
            (articles as KbArticleListItem[]).map((article) => (
              <KbArticleCard key={article.id} article={article} />
            ))}
        </div>
      </PageBody>
    </>
  );
}

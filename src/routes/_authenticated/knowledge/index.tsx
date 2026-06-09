import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Plus, Search, Settings2 } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n, localized } from "@/i18n";
import { useAccessContext } from "@/lib/access/hooks";
import { listKbArticles, listKbCategories } from "@/lib/api/kb.functions";

export const Route = createFileRoute("/_authenticated/knowledge/")({
  beforeLoad: () => requireModule("knowledge_base"),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { t, locale } = useI18n();
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
      <PageBody>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("kb.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={categoryId === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategoryId(null)}
            >
              {t("common.all")}
            </Badge>
            {categories.map((c: { id: string; name_ru: string; name_kk: string }) => (
              <Badge
                key={c.id}
                variant={categoryId === c.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategoryId(c.id)}
              >
                {localized(c, locale, "name")}
              </Badge>
            ))}
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {!isLoading && articles.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          )}

          <div className="grid gap-3">
            {articles.map((a: {
              id: string;
              title_ru: string;
              title_kk: string;
              summary_ru: string;
              summary_kk: string;
              tags: string[];
              source_document_id: string | null;
            }) => (
              <Card key={a.id} className="hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <Link to="/knowledge/$id" params={{ id: a.id }} className="hover:underline">
                      {localized(a, locale, "title")}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="text-muted-foreground line-clamp-2">
                    {localized(a, locale, "summary")}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {a.source_document_id && (
                      <Badge variant="secondary" className="text-[10px]">
                        <BookOpen className="w-3 h-3 mr-1" />
                        {t("kb.fromDocument")}
                      </Badge>
                    )}
                    {(a.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </PageBody>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useI18n, localized } from "@/i18n";
import { requireModule } from "@/lib/access/route-guards";
import {
  listKbArticles,
  listKbCategoriesAdmin,
  upsertKbCategory,
} from "@/lib/api/kb.functions";

export const Route = createFileRoute("/_authenticated/knowledge/manage")({
  beforeLoad: () => requireModule("knowledge_base", "write"),
  component: KbManagePage,
});

function KbManagePage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [catCode, setCatCode] = useState("");
  const [catNameRu, setCatNameRu] = useState("");
  const [catNameKk, setCatNameKk] = useState("");

  const { data: articles = [] } = useQuery({
    queryKey: ["kb-articles-admin"],
    queryFn: () => listKbArticles({ data: { include_all: true, limit: 200 } }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["kb-categories-admin"],
    queryFn: listKbCategoriesAdmin,
  });

  const createCategory = useMutation({
    mutationFn: () =>
      upsertKbCategory({
        data: {
          code: catCode.trim(),
          name_ru: catNameRu.trim(),
          name_kk: catNameKk.trim() || catNameRu.trim(),
        },
      }),
    onSuccess: () => {
      toast.success(t("kb.categorySaved"));
      setCatCode("");
      setCatNameRu("");
      setCatNameKk("");
      qc.invalidateQueries({ queryKey: ["kb-categories-admin"] });
      qc.invalidateQueries({ queryKey: ["kb-categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCategory = useMutation({
    mutationFn: (cat: { id: string; code: string; name_ru: string; name_kk: string; is_active: boolean }) =>
      upsertKbCategory({
        data: {
          id: cat.id,
          code: cat.code,
          name_ru: cat.name_ru,
          name_kk: cat.name_kk,
          is_active: !cat.is_active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-categories-admin"] });
      qc.invalidateQueries({ queryKey: ["kb-categories"] });
    },
  });

  return (
    <>
      <PageHeader
        title={t("kb.manageTitle")}
        actions={
          <Button size="sm" asChild>
            <Link to="/knowledge/new">
              <Plus className="w-4 h-4 mr-1" />
              {t("kb.newArticle")}
            </Link>
          </Button>
        }
      />
      <PageBody>
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("kb.categoriesTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>{t("kb.field.code")}</Label>
                  <Input value={catCode} onChange={(e) => setCatCode(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("kb.field.nameRu")}</Label>
                  <Input value={catNameRu} onChange={(e) => setCatNameRu(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("kb.field.nameKk")}</Label>
                  <Input value={catNameKk} onChange={(e) => setCatNameKk(e.target.value)} />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!catCode.trim() || !catNameRu.trim() || createCategory.isPending}
                onClick={() => createCategory.mutate()}
              >
                {t("kb.addCategory")}
              </Button>
              <div className="space-y-2">
                {categories.map(
                  (c: {
                    id: string;
                    code: string;
                    name_ru: string;
                    name_kk: string;
                    is_active: boolean;
                  }) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                        <span className="ml-2">{localized(c, locale, "name")}</span>
                      </div>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={() => toggleCategory.mutate(c)}
                      />
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("kb.allArticles")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {articles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
              ) : (
                articles.map(
                  (a: {
                    id: string;
                    title_ru: string;
                    title_kk: string;
                    status: string;
                  }) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <Link
                        to="/knowledge/$id/edit"
                        params={{ id: a.id }}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {localized(a, locale, "title")}
                      </Link>
                      <Badge variant="outline">{t(`kb.status.${a.status}`)}</Badge>
                    </div>
                  ),
                )
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

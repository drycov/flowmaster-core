import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import { getKbArticle, listKbCategories, upsertKbArticle } from "@/lib/api/kb.functions";

type ArticleForm = {
  title_ru: string;
  title_kk: string;
  summary_ru: string;
  summary_kk: string;
  body_ru: string;
  body_kk: string;
  category_id: string;
  status: "draft" | "published" | "archived";
  tags: string;
};

const emptyForm: ArticleForm = {
  title_ru: "",
  title_kk: "",
  summary_ru: "",
  summary_kk: "",
  body_ru: "",
  body_kk: "",
  category_id: "",
  status: "draft",
  tags: "",
};

export function KbArticleEditor({ articleId }: { articleId?: string }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<ArticleForm>(emptyForm);

  const { data: categories = [] } = useQuery({
    queryKey: ["kb-categories"],
    queryFn: listKbCategories,
  });

  const { data: article, isLoading } = useQuery({
    queryKey: ["kb-article", articleId],
    queryFn: () => getKbArticle({ data: { id: articleId! } }),
    enabled: !!articleId,
    select: (row) => row as unknown as ArticleForm & { id: string; tags: string[] },
  });

  useEffect(() => {
    if (!article) return;
    setForm({
      title_ru: (article.title_ru as string) ?? "",
      title_kk: (article.title_kk as string) ?? "",
      summary_ru: (article.summary_ru as string) ?? "",
      summary_kk: (article.summary_kk as string) ?? "",
      body_ru: (article.body_ru as string) ?? "",
      body_kk: (article.body_kk as string) ?? "",
      category_id: (article.category_id as string) ?? "",
      status: (article.status as ArticleForm["status"]) ?? "draft",
      tags: ((article.tags as string[]) ?? []).join(", "),
    });
  }, [article]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertKbArticle({
        data: {
          id: articleId,
          title_ru: form.title_ru.trim(),
          title_kk: form.title_kk.trim() || form.title_ru.trim(),
          summary_ru: form.summary_ru,
          summary_kk: form.summary_kk || form.summary_ru,
          body_ru: form.body_ru,
          body_kk: form.body_kk || form.body_ru,
          category_id: form.category_id || null,
          status: form.status,
          tags: form.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (row) => {
      toast.success(t("kb.saved"));
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
      if (!articleId && row?.id) {
        navigate({ to: "/knowledge/$id/edit", params: { id: row.id as string } });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (articleId && isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("kb.field.titleRu")}</Label>
          <Input
            value={form.title_ru}
            onChange={(e) => setForm((f) => ({ ...f, title_ru: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("kb.field.titleKk")}</Label>
          <Input
            value={form.title_kk}
            onChange={(e) => setForm((f) => ({ ...f, title_kk: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("kb.field.summaryRu")}</Label>
          <Textarea
            rows={2}
            value={form.summary_ru}
            onChange={(e) => setForm((f) => ({ ...f, summary_ru: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("kb.field.summaryKk")}</Label>
          <Textarea
            rows={2}
            value={form.summary_kk}
            onChange={(e) => setForm((f) => ({ ...f, summary_kk: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("kb.field.bodyRu")}</Label>
          <Textarea
            rows={10}
            value={form.body_ru}
            onChange={(e) => setForm((f) => ({ ...f, body_ru: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("kb.field.bodyKk")}</Label>
          <Textarea
            rows={10}
            value={form.body_kk}
            onChange={(e) => setForm((f) => ({ ...f, body_kk: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>{t("kb.field.category")}</Label>
          <Select
            value={form.category_id || "__none"}
            onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "__none" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("kb.field.category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {categories.map((c: { id: string; name_ru: string; name_kk: string }) => (
                <SelectItem key={c.id} value={c.id}>
                  {localized(c, locale, "name")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("common.status")}</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm((f) => ({ ...f, status: v as ArticleForm["status"] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t("kb.status.draft")}</SelectItem>
              <SelectItem value="published">{t("kb.status.published")}</SelectItem>
              <SelectItem value="archived">{t("kb.status.archived")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("kb.field.tags")}</Label>
          <Input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder={t("kb.field.tagsHint")}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          disabled={!form.title_ru.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {t("common.save")}
        </Button>
        <Button variant="outline" onClick={() => navigate({ to: "/knowledge" })}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

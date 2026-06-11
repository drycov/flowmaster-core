import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n, localized } from "@/i18n";
import { cn } from "@/lib/utils";

export type KbArticleListItem = {
  id: string;
  title_ru: string;
  title_kk: string;
  summary_ru: string;
  summary_kk: string;
  tags: string[];
  source_document_id: string | null;
  published_at: string | null;
  kb_categories: { name_ru: string; name_kk: string } | null;
};

function formatPublishedAt(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function KbArticleCard({ article }: { article: KbArticleListItem }) {
  const { t, locale } = useI18n();
  const published = formatPublishedAt(article.published_at, locale);
  const category = article.kb_categories;

  return (
    <Card className="group transition-colors hover:border-primary/30">
      <CardContent className="p-4">
        <Link
          to="/knowledge/$id"
          params={{ id: article.id }}
          className="flex items-start gap-3"
        >
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {localized(category, locale, "name")}
                </Badge>
              )}
              {published && (
                <span className="text-[11px] text-muted-foreground">{published}</span>
              )}
            </div>
            <h2 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
              {localized(article, locale, "title")}
            </h2>
            {localized(article, locale, "summary") && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {localized(article, locale, "summary")}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {article.source_document_id && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  <BookOpen className="w-3 h-3 mr-1" />
                  {t("kb.fromDocument")}
                </Badge>
              )}
              {(article.tags ?? []).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <ChevronRight
            className={cn(
              "w-4 h-4 shrink-0 mt-1 text-muted-foreground/50",
              "group-hover:text-primary transition-colors",
            )}
          />
        </Link>
      </CardContent>
    </Card>
  );
}

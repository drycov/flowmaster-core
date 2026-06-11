import { BookOpen, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function KbEmptyState({ canManage }: { canManage?: boolean }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <BookOpen className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground">{t("kb.emptyTitle")}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("kb.emptyHint")}</p>
      {canManage && (
        <Button size="sm" className="mt-5" asChild>
          <Link to="/knowledge/new">
            <Plus className="w-4 h-4 mr-1" />
            {t("kb.newArticle")}
          </Link>
        </Button>
      )}
    </div>
  );
}

// src/components/templates-list/components/TemplateCard.tsx
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { FileText, Archive, CheckCircle, Clock } from "lucide-react";
import { useI18n, localized, interpolate } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import type { ReferenceCodeOption } from "@/components/references/ReferenceCodeSelect";
import { resolveReferenceLabel } from "@/lib/references/resolve-label";

// Используем любой тип для совместимости с API
interface TemplateCardProps {
  template: {
    id: string;
    name_ru: string;
    name_kk: string;
    category: string;
    status: string;
    version: number;
    updated_at: string;
  };
  categories?: ReferenceCodeOption[];
}

export function TemplateCard({ template, categories = [] }: TemplateCardProps) {
  const { t, locale } = useI18n();
  const categoryLabel =
    resolveReferenceLabel(categories, template.category, locale) ?? t("tpl.noCategory");

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "published":
        return {
          icon: CheckCircle,
          label: t("tpl.published"),
          color: "bg-green-100 text-green-800",
        };
      case "archived":
        return { icon: Archive, label: t("tpl.archived"), color: "bg-gray-100 text-gray-800" };
      default:
        return { icon: Clock, label: t("tpl.draft"), color: "bg-yellow-100 text-yellow-800" };
    }
  };

  const statusConfig = getStatusConfig(template.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Link
      to="/templates/$id"
      params={{ id: template.id }}
      className="block transition-all duration-200"
    >
      <div className="group border border-border bg-card rounded-sm p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              <div className="font-medium text-sm truncate">
                {localized(template, locale, "name")}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{categoryLabel}</div>
          </div>
          <Badge variant="outline" className={`text-[10px] uppercase ${statusConfig.color}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{interpolate(t("tpl.version"), { n: template.version })}</span>
          <span>{fmtDateShort(template.updated_at, locale)}</span>
        </div>
      </div>
    </Link>
  );
}

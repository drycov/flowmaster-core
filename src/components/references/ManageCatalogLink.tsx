import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { getCatalogById } from "@/lib/references/catalogs";

type ManageCatalogLinkProps = {
  catalogId: string;
  labelKey?: string;
  variant?: "outline" | "ghost" | "link";
  size?: "sm" | "default";
};

export function ManageCatalogLink({
  catalogId,
  labelKey,
  variant = "outline",
  size = "sm",
}: ManageCatalogLinkProps) {
  const { t } = useI18n();
  const catalog = getCatalogById(catalogId);
  if (!catalog) return null;

  const label = labelKey ? t(labelKey) : t(catalog.titleKey);

  if (variant === "link") {
    return (
      <Link
        to="/references/$catalog"
        params={{ catalog: catalogId }}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <BookOpen className="h-3.5 w-3.5" />
        {label}
      </Link>
    );
  }

  return (
    <Button variant={variant} size={size} asChild>
      <Link to="/references/$catalog" params={{ catalog: catalogId }}>
        <BookOpen className="mr-1 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

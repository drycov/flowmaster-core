import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n";
import { linkClass } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export function KbBackLink({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <Link to="/knowledge" className={cn(linkClass, "inline-flex items-center gap-1.5", className)}>
      <ArrowLeft className="w-4 h-4" />
      {t("kb.backToList")}
    </Link>
  );
}

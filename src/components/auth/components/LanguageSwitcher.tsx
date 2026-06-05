import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "ru" ? "kk" : "ru")}
      className="gap-1.5"
    >
      <Languages className="w-4 h-4" />
      <span className="font-mono text-xs">{locale.toUpperCase()}</span>
    </Button>
  );
}
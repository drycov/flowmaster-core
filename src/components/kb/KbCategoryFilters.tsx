import { useI18n, localized } from "@/i18n";
import { cn } from "@/lib/utils";

type Category = { id: string; name_ru: string; name_kk: string };

export function KbCategoryFilters({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip active={value === null} onClick={() => onChange(null)}>
        {t("common.all")}
      </FilterChip>
      {categories.map((c) => (
        <FilterChip key={c.id} active={value === c.id} onClick={() => onChange(c.id)}>
          {localized(c, locale, "name")}
        </FilterChip>
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

import { ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { PageBody, PageHeader } from "@/components/AppShell";

/** Обёртка таблицы — единый вид списков */
export function DataTableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-sm overflow-hidden", className)}>
      {children}
    </div>
  );
}

/** Панель фильтров над таблицей */
export function PageToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap items-center gap-2 mb-3", className)}>{children}</div>;
}

/** Поле поиска с иконкой (h-9, как на /documents) */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  clearable,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className={cn("relative flex-1 max-w-md", className)}>
      <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
      <Input
        placeholder={placeholder}
        className={cn("pl-8 h-9", clearable && value && "pr-8")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          aria-label={t("shell.clearSearch")}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function TableStatusRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground text-sm">
        {children}
      </td>
    </tr>
  );
}

export function PageLoading({ label }: { label?: string }) {
  return (
    <div className="flex justify-center items-center h-64 gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin shrink-0" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="rounded-sm border border-destructive/20 bg-destructive/10 p-4 text-destructive text-sm">
      {message}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </h2>
  );
}

/** Боковая / контентная панель (деревья, детали) */
export function PanelCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-sm overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function ListEmpty({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-muted-foreground text-sm">{children}</div>;
}

/** Скелет страницы при загрузке / ошибке */
export function PageState({
  title,
  description,
  loading,
  error,
  children,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  error?: unknown;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <>
        <PageHeader title={title} description={description} />
        <PageBody>
          <PageLoading />
        </PageBody>
      </>
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <>
        <PageHeader title={title} description={description} />
        <PageBody>
          <PageError message={message} />
        </PageBody>
      </>
    );
  }
  return <>{children}</>;
}

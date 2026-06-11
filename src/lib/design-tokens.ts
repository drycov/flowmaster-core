/**
 * ЕСЭДО Design System — единые токены для auth и приложения.
 * Значения дублируются в src/styles.css как CSS-переменные.
 */
export const ds = {
  brand: {
    navy: "#0A4A8A",
    primary: "#2F80ED",
    primaryHover: "#2568C4",
    primaryActive: "#1E5FA8",
  },
  surface: {
    page: "#F5F7FA",
    card: "#FFFFFF",
    field: "#E8EAED",
  },
  text: {
    primary: "#32363A",
    secondary: "#6A6D70",
    muted: "#89919A",
  },
  border: {
    default: "#E5E5E5",
    strong: "#D9D9D9",
  },
} as const;

/** Поля ввода — borderless на сером фоне, как на экране входа. */
export const fieldClass =
  "h-10 w-full rounded-lg border-0 bg-input px-3.5 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50";

/** Крупное поле (экран входа). */
export const fieldLgClass =
  "h-12 w-full rounded-lg border-0 bg-input px-4 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:opacity-60";

/** Основная CTA-кнопка. */
export const btnPrimaryClass =
  "h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-none transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60";

/** Pill CTA (экран входа). */
export const btnPrimaryPillClass =
  "h-12 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-none transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-60";

export const linkClass =
  "text-sm font-normal text-primary hover:text-primary/80 hover:underline";

export const labelClass = "text-xs font-normal text-muted-foreground";

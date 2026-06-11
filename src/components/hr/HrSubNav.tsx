import { Link, useRouterState } from "@tanstack/react-router";
import { HR_NAV } from "@/lib/access/navigation";
import { useAccessContext } from "@/lib/access/hooks";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function HrSubNav() {
  const { t } = useI18n();
  const { canModule } = useAccessContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = HR_NAV.items.filter((item) => {
    const action = item.action ?? "read";
    return canModule(item.moduleId ?? "hr", action);
  });

  if (items.length <= 1) return null;

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={t("nav.sectionHr")}
    >
      {items.map((item) => {
        const active =
          pathname === item.to || (item.to !== "/hr/leave" && pathname.startsWith(item.to));
        return (
          <Link
            key={item.id}
            to={item.to}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

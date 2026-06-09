import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  GitBranch,
  Library,
  FilePlus2,
  Archive,
  Search,
  Bell,
  ShieldCheck,
  Users,
  Building2,
  LogOut,
  ChevronDown,
  ChevronRight,
  Languages,
  CheckSquare,
  User,
  HelpCircle,
  BookMarked,
  AlertTriangle,
  Inbox,
  SendHorizontal,
  BarChart3,
  CalendarDays,
  ClipboardList,
  UserRoundCog,
  BookOpen,
  FolderKanban,
  ScrollText,
  Contact,
  Shield,
  Clock,
  ChartGantt,
  Lock,
  Briefcase,
  Network,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, localized } from "@/i18n";
import { useAccessContext } from "@/lib/access/hooks";
import {
  ADMIN_NAV_SECTIONS,
  CORRESPONDENCE_NAV,
  HR_NAV,
  REFERENCE_NAV,
  REGISTRY_NAV,
  SERVICE_NAV,
  WORK_NAV,
  filterAdminSections,
  filterNavGroup,
  filterNavItems,
  type NavItemDef,
} from "@/lib/access/navigation";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAccessTokenRefresh } from "@/lib/auth/client/useAccessTokenRefresh";

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
};

function isNavActive(path: string, to: string) {
  return path === to || path.startsWith(to + "/");
}

function SidebarNavLink({ item, path }: { item: NavItem; path: string }) {
  const active = isNavActive(path, item.to);

  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      )}
    >
      <item.icon className="w-4 h-4 shrink-0 opacity-70" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
          {item.badge}
        </Badge>
      ) : null}
    </Link>
  );
}

function SidebarNavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-2 space-y-0.5">
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        {label}
      </div>
      {children}
    </div>
  );
}

function SidebarNavSubheading({ label }: { label: string }) {
  return (
    <div className="px-2 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
      {label}
    </div>
  );
}

function SidebarNavGroup({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="px-2">
      <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:bg-sidebar-accent/50 transition-colors">
        <ChevronRight
          className={cn("w-3 h-3 shrink-0 transition-transform duration-200", open && "rotate-90")}
        />
        <span className="flex-1 text-left">{label}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5 space-y-0.5 pl-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const router = useRouterState();
  const path = router.location.pathname;

  const { me, license, canModule, can, isWritable, isLoading: accessLoading } = useAccessContext();
  useAccessTokenRefresh();

  const userId = (me?.profile as { id?: string } | undefined)?.id;
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      if (mounted) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-shell", { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        load,
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  const roles = me?.roles ?? [];

  const NAV_ICONS: Record<string, LucideIcon> = {
    dashboard: LayoutDashboard,
    documents: FileText,
    tasks: CheckSquare,
    substitutions: UserRoundCog,
    approvals: ListChecks,
    "hr-leave": CalendarDays,
    "hr-leave-schedule": CalendarDays,
    "hr-duty": Shield,
    "hr-timesheet": Clock,
    "hr-gantt": ChartGantt,
    "hr-directory": Contact,
    "hr-admin": ClipboardList,
    incoming: Inbox,
    outgoing: SendHorizontal,
    knowledge: BookOpen,
    projects: FolderKanban,
    contracts: ScrollText,
    counterparties: Building2,
    search: Search,
    notifications: Bell,
    archive: Archive,
    references: BookMarked,
    nomenclature: Library,
    templates: FilePlus2,
    workflows: GitBranch,
    reports: BarChart3,
    users: Users,
    roles: Shield,
    permissions: Lock,
    organization: Building2,
    departments: Network,
    positions: Briefcase,
    calendar: CalendarDays,
    audit: ShieldCheck,
    settings: Settings,
    integrations: Network,
  };

  const toNavItem = (def: NavItemDef): NavItem => ({
    to: def.to,
    icon: NAV_ICONS[def.id] ?? FileText,
    label: t(def.labelKey),
    badge: def.id === "notifications" ? unread : undefined,
  });

  const {
    workNavItems,
    hrNavItems,
    correspondenceNavItems,
    registryNavItems,
    serviceNavItems,
    referenceNavItems,
    adminSections,
  } = useMemo(() => {
    const work = filterNavItems(WORK_NAV, canModule).map(toNavItem);
    const hr = filterNavGroup(HR_NAV, canModule).map(toNavItem);
    const correspondence = filterNavGroup(CORRESPONDENCE_NAV, canModule).map(toNavItem);
    const registry = filterNavItems(REGISTRY_NAV, canModule).map(toNavItem);
    const service = filterNavItems(SERVICE_NAV, canModule).map(toNavItem);
    const reference = filterNavItems(REFERENCE_NAV, canModule).map(toNavItem);
    const admin = filterAdminSections(ADMIN_NAV_SECTIONS, canModule).map((section) => ({
      key: section.key,
      label: t(section.labelKey),
      items: section.items.map(toNavItem),
    }));
    return {
      workNavItems: work,
      hrNavItems: hr,
      correspondenceNavItems: correspondence,
      registryNavItems: registry,
      serviceNavItems: service,
      referenceNavItems: reference,
      adminSections: admin,
    };
  }, [canModule, t, unread]);

  const isHrActive = hrNavItems.some((item) => isNavActive(path, item.to));
  const isCorrespondenceActive = correspondenceNavItems.some((item) => isNavActive(path, item.to));
  const isRegistryActive = registryNavItems.some((item) => isNavActive(path, item.to));
  const isServiceActive = serviceNavItems.some((item) => isNavActive(path, item.to));
  const isReferencesActive = referenceNavItems.some((item) => isNavActive(path, item.to));
  const isAdminActive = adminSections.some((section) =>
    section.items.some((item) => isNavActive(path, item.to)),
  );

  const licenseBanner = (() => {
    if (accessLoading || !license) return null;
    if (license.server_revoked) {
      return { tone: "destructive" as const, text: t("license.banner.serverRevoked") };
    }
    if (license.sync_stale && license.activation_mode === "online") {
      return {
        tone: "warning" as const,
        text: t("license.banner.syncStale").replace(
          "{h}",
          String(license.offline_grace_hours ?? 72),
        ),
      };
    }
    if (license.status === "suspended") {
      return { tone: "destructive" as const, text: t("license.banner.suspended") };
    }
    if (license.status === "expired") {
      return { tone: "destructive" as const, text: t("license.banner.expired") };
    }
    if (license.status === "grace") {
      const days = license.grace_days_remaining ?? license.grace_days;
      return {
        tone: "warning" as const,
        text: t("license.banner.grace").replace("{n}", String(days)),
      };
    }
    if (
      license.status === "active" &&
      license.days_remaining !== null &&
      license.days_remaining <= 14
    ) {
      return {
        tone: "warning" as const,
        text: t("license.banner.expiring").replace("{n}", String(license.days_remaining)),
      };
    }
    if (can("manage_license") && license.max_users > 0 && license.seats_available <= 0) {
      return { tone: "destructive" as const, text: t("license.banner.seatsFull") };
    }
    if (
      can("manage_license") &&
      license.max_users > 0 &&
      license.active_users / license.max_users >= 0.8 &&
      license.seats_available > 0
    ) {
      const pct = Math.round((license.active_users / license.max_users) * 100);
      return {
        tone: "warning" as const,
        text: t("license.banner.seatsWarning").replace("{n}", String(pct)),
      };
    }
    if (
      can("manage_license") &&
      license.plan === "trial" &&
      license.days_remaining !== null &&
      license.days_remaining <= 7
    ) {
      return {
        tone: "warning" as const,
        text: t("license.banner.trialExpiring").replace("{n}", String(license.days_remaining)),
      };
    }
    return null;
  })();

  const readOnlyBanner =
    !accessLoading && license && !isWritable ? t("license.banner.readOnly") : null;

  const profile = me?.profile as
    | { full_name_ru?: string | null; full_name_kk?: string | null; email?: string }
    | undefined;
  const displayName = profile ? localized(profile, locale, "full_name") || profile.email || "" : "";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    try {
      const { logout } = await import("@/lib/api/auth.functions");
      const { clearSession } = await import("@/lib/auth/session-storage");
      const { resetSupabaseClient } = await import("@/integrations/supabase/client");
      await logout();
      clearSession();
      resetSupabaseClient();
    } catch {
      const { clearSession } = await import("@/lib/auth/session-storage");
      const { resetSupabaseClient } = await import("@/integrations/supabase/client");
      clearSession();
      resetSupabaseClient();
    }
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-sm bg-sidebar-primary flex items-center justify-center font-bold text-sidebar-primary-foreground">
              {t("shell.brandAbbr")}
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-sm">{t("app.name")}</div>
              <div className="text-[11px] text-sidebar-foreground/60">{t("shell.version")}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 space-y-3">
          <SidebarNavSection label={t("nav.work")}>
            {workNavItems.map((item) => (
              <SidebarNavLink key={item.to} item={item} path={path} />
            ))}
          </SidebarNavSection>

          {hrNavItems.length > 0 && (
            <SidebarNavGroup label={t("nav.sectionHr")} active={isHrActive}>
              {hrNavItems.map((item) => (
                <SidebarNavLink key={item.to} item={item} path={path} />
              ))}
            </SidebarNavGroup>
          )}

          {correspondenceNavItems.length > 0 && (
            <SidebarNavGroup label={t("nav.correspondence")} active={isCorrespondenceActive}>
              {correspondenceNavItems.map((item) => (
                <SidebarNavLink key={item.to} item={item} path={path} />
              ))}
            </SidebarNavGroup>
          )}

          {registryNavItems.length > 0 && (
            <SidebarNavGroup label={t("nav.registry")} active={isRegistryActive}>
              {registryNavItems.map((item) => (
                <SidebarNavLink key={item.to} item={item} path={path} />
              ))}
            </SidebarNavGroup>
          )}

          <SidebarNavGroup label={t("nav.tools")} active={isServiceActive}>
            {serviceNavItems.map((item) => (
              <SidebarNavLink key={item.to} item={item} path={path} />
            ))}
          </SidebarNavGroup>

          {referenceNavItems.length > 0 && (
            <SidebarNavGroup label={t("nav.references")} active={isReferencesActive}>
              {referenceNavItems.map((item) => (
                <SidebarNavLink key={item.to} item={item} path={path} />
              ))}
            </SidebarNavGroup>
          )}

          {adminSections.length > 0 && (
            <SidebarNavGroup label={t("nav.admin")} active={isAdminActive}>
              {adminSections.map((section) => (
                <div key={section.key}>
                  <SidebarNavSubheading label={section.label} />
                  {section.items.map((item) => (
                    <SidebarNavLink key={item.to} item={item} path={path} />
                  ))}
                </div>
              ))}
            </SidebarNavGroup>
          )}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50">
          {t("app.tagline")}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 bg-card border-b border-border flex items-center px-4 gap-4">
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocale(locale === "ru" ? "kk" : "ru")}
            className="gap-1.5"
          >
            <Languages className="w-4 h-4" />
            <span className="font-mono text-xs">{locale.toUpperCase()}</span>
          </Button>
          <Link to="/notifications" className="relative p-2 hover:bg-muted rounded">
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            )}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-[11px] bg-primary text-primary-foreground">
                    {initials || "—"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{displayName}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-normal">{displayName}</div>
                <div className="text-xs text-muted-foreground">{profile?.email}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px] py-0">
                      {r}
                    </Badge>
                  ))}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                <User className="w-4 h-4 mr-2" />
                {t("nav.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/help" })}>
                <HelpCircle className="w-4 h-4 mr-2" />
                {t("nav.help")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                {t("nav.signout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        {licenseBanner ? (
          <div
            className={cn(
              "px-4 py-2 text-sm flex items-center gap-2 border-b",
              licenseBanner.tone === "destructive"
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/20",
            )}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{licenseBanner.text}</span>
            {can("manage_license") ? (
              <Link
                to="/admin/settings"
                search={{ tab: "license" }}
                className="underline font-medium shrink-0"
              >
                {t("license.banner.manage")}
              </Link>
            ) : null}
          </div>
        ) : readOnlyBanner ? (
          <div className="px-4 py-2 text-sm flex items-center gap-2 border-b bg-muted/80 text-muted-foreground border-border">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{readOnlyBanner}</span>
          </div>
        ) : null}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card px-6 py-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

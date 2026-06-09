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
  Settings,
  Users,
  Building2,
  LogOut,
  ChevronDown,
  Languages,
  CheckSquare,
  User,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, localized } from "@/i18n";
import { getMyProfile } from "@/lib/api/admin.functions";
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

function SidebarNavLink({
  item,
  path,
}: {
  item: { to: string; icon: typeof LayoutDashboard; label: string; badge?: number };
  path: string;
}) {
  const active = path === item.to || path.startsWith(item.to + "/");

  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-sidebar-accent transition-colors",
        active && "bg-sidebar-accent border-l-2 border-sidebar-primary",
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
          {item.badge}
        </Badge>
      ) : null}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const router = useRouterState();
  const path = router.location.pathname;

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
  });

  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (mounted) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-shell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, load)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const roles = me?.roles ?? [];
  const perms = me?.permissions ?? {};
  const isAdmin = roles.includes("admin");
  const can = (p: string) => isAdmin || !!perms[p as keyof typeof perms];

  type NavItem = {
    to: string;
    icon: typeof LayoutDashboard;
    label: string;
    badge?: number;
  };

  const mainNavItems: NavItem[] = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/documents", icon: FileText, label: t("nav.documents") },
    { to: "/tasks", icon: CheckSquare, label: t("nav.tasks") },
    { to: "/approvals", icon: ListChecks, label: t("nav.approvals") },
    { to: "/archive", icon: Archive, label: t("nav.archive") },
    { to: "/search", icon: Search, label: t("nav.search") },
    { to: "/notifications", icon: Bell, label: t("nav.notifications"), badge: unread },
  ];

  const referenceNavItems: NavItem[] = [
    { to: "/nomenclature", icon: Library, label: t("nav.nomenclature") },
    { to: "/templates", icon: FilePlus2, label: t("nav.templates") },
    { to: "/workflows", icon: GitBranch, label: t("nav.workflows") },
  ];

  const adminItems = [
    { to: "/audit", icon: ShieldCheck, label: t("nav.audit"), show: can("view_audit") },
    { to: "/admin/users", icon: Users, label: t("nav.users"), show: can("manage_users") },
    { to: "/admin/roles", icon: ShieldCheck, label: t("nav.roles"), show: can("manage_users") || can("manage_roles") },
    { to: "/admin/permissions", icon: ShieldCheck, label: t("nav.permissions"), show: can("manage_roles") },
    { to: "/admin/organization", icon: Building2, label: t("nav.organization"), show: can("manage_org") },
    { to: "/admin/departments", icon: Building2, label: t("nav.departments"), show: can("manage_org") },
    { to: "/admin/positions", icon: Settings, label: t("nav.positions"), show: can("manage_org") },
  ].filter((item) => item.show);

  const profile = me?.profile as { full_name_ru?: string | null; full_name_kk?: string | null; email?: string } | undefined;
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
        <nav className="flex-1 overflow-y-auto py-2">
          {mainNavItems.map((item) => (
            <SidebarNavLink key={item.to} item={item} path={path} />
          ))}

          <div className="px-4 mt-4 mb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
            {t("nav.references")}
          </div>
          {referenceNavItems.map((item) => (
            <SidebarNavLink key={item.to} item={item} path={path} />
          ))}

          {adminItems.length > 0 && (
            <>
              <div className="px-4 mt-4 mb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
                {t("nav.admin")}
              </div>
              {adminItems.map((item) => (
                <SidebarNavLink key={item.to} item={item} path={path} />
              ))}
            </>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                {t("nav.signout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
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

// Settings icon re-export for callers
export { Settings };

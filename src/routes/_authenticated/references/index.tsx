import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import {
  FileText,
  Layers,
  Building,
  Truck,
  Shield,
  Zap,
  Clock,
  BookOpen,
  Archive,
  Network,
  XCircle,
  Link as LinkIcon,
  Library,
  FilePlus2,
  GitBranch,
  Settings,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { EXTERNAL_REFERENCE_LINKS, REFERENCE_CATALOGS } from "@/lib/references/catalogs";
import { getMyProfile } from "@/lib/api/admin.functions";

const ICONS: Record<string, typeof FileText> = {
  FileText,
  Layers,
  Building,
  Truck,
  Shield,
  Zap,
  Clock,
  BookOpen,
  Archive,
  Network,
  XCircle,
  Link: LinkIcon,
  Library,
  FilePlus2,
  GitBranch,
  Settings,
};

export const Route = createFileRoute("/_authenticated/references/")({
  beforeLoad: () => requireModule("references"),
  component: ReferencesIndexPage,
});

function ReferencesIndexPage() {
  const { t } = useI18n();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const roles = me?.roles ?? [];
  const perms = me?.permissions ?? {};
  const can = (p?: string) => !p || roles.includes("admin") || !!(p && perms[p as keyof typeof perms]);

  return (
    <>
      <PageHeader
        title={t("ref.hubTitle")}
        description={t("ref.hubDescription")}
      />

      <PageBody>
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            {t("ref.coreSection")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXTERNAL_REFERENCE_LINKS.filter((item) => can(item.permission)).map((item) => {
              const Icon = ICONS[item.icon] ?? FileText;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-start gap-3 p-4 border border-border rounded-sm bg-card hover:bg-muted/40 transition-colors"
                >
                  <Icon className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{t(item.titleKey)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t(item.descriptionKey)}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            {t("ref.auxSection")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REFERENCE_CATALOGS.map((catalog) => {
              const Icon = ICONS[catalog.icon] ?? FileText;
              return (
                <Link
                  key={catalog.id}
                  to="/references/$catalog"
                  params={{ catalog: catalog.id }}
                  className="group flex items-start gap-3 p-4 border border-border rounded-sm bg-card hover:bg-muted/40 transition-colors"
                >
                  <Icon className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{t(catalog.titleKey)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t(catalog.descriptionKey)}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>
        </section>
      </PageBody>
    </>
  );
}

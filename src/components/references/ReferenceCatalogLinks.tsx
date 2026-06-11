import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { getMyProfile } from "@/lib/api/admin.functions";
import { userHasPermission } from "@/lib/access/rbac";
import {
  getCatalogsBySection,
  REFERENCE_CATALOGS,
  type RefCatalogSection,
} from "@/lib/references/catalogs";

type ReferenceCatalogLinksProps = {
  section?: RefCatalogSection;
  catalogIds?: string[];
  titleKey?: string;
};

export function ReferenceCatalogLinks({
  section,
  catalogIds,
  titleKey = "ref.catalogLinksTitle",
}: ReferenceCatalogLinksProps) {
  const { t } = useI18n();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const canManage = userHasPermission({ permissions: me?.permissions ?? {} }, "manage_references");

  if (!canManage) return null;

  let catalogs = REFERENCE_CATALOGS;
  if (section) {
    catalogs = getCatalogsBySection(section);
  }
  if (catalogIds?.length) {
    const allowed = new Set(catalogIds);
    catalogs = catalogs.filter((c) => allowed.has(c.id));
  }
  if (!catalogs.length) return null;

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <BookOpen className="h-4 w-4" />
        {t(titleKey)}
      </div>
      <ul className="space-y-1">
        {catalogs.map((catalog) => (
          <li key={catalog.id}>
            <Link
              to="/references/$catalog"
              params={{ catalog: catalog.id }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {t(catalog.titleKey)}
              <ChevronRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

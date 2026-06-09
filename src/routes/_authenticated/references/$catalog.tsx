import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { ChevronLeft } from "lucide-react";
import { getCatalogById } from "@/lib/references/catalogs";
import { ReferenceCatalogPage } from "@/components/references/ReferenceCatalogPage";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/references/$catalog")({
  beforeLoad: () => requireModule("references"),
  component: ReferenceCatalogRoute,
});

function ReferenceCatalogRoute() {
  const { catalog: catalogId } = Route.useParams();
  const catalog = getCatalogById(catalogId);
  const { t } = useI18n();

  if (!catalog) throw notFound();

  return (
    <div>
      <div className="px-6 pt-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to="/references">
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t("ref.backToHub")}
          </Link>
        </Button>
      </div>
      <ReferenceCatalogPage catalog={catalog} />
    </div>
  );
}

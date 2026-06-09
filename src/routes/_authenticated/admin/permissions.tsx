import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/AppShell";
import {
  DataTableShell,
  ListEmpty,
  PageLoading,
  SectionTitle,
} from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  beforeLoad: () => requireModule("admin_roles", "manage"),
  component: PermissionsPage,
});

type Permission = {
  code: string;
  category: string;
  description_ru: string;
  description_kk: string;
};

function PermissionsPage() {
  const { t, locale } = useI18n();
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions" as never)
        .select("*")
        .order("category", { ascending: true })
        .order("code", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Permission[];
    },
  });

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <>
      <PageHeader title={t("permissions.title")} description={t("permissions.description")} />
      <PageBody>
        {isLoading ? (
          <PageLoading label={t("common.loading")} />
        ) : permissions.length === 0 ? (
          <ListEmpty>{t("permissions.empty")}</ListEmpty>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, list]) => (
              <section key={cat}>
                <SectionTitle>{cat}</SectionTitle>
                <DataTableShell>
                  <table className="w-full data-table">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-2 w-72">{t("common.code")}</th>
                        <th className="text-left px-4 py-2">{t("common.description")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((p) => (
                        <tr key={p.code} className="border-t border-border hover:bg-muted/40">
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {p.code}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {locale === "kk" ? p.description_kk : p.description_ru}
                            <div className="text-xs text-muted-foreground">
                              {locale === "kk" ? p.description_ru : p.description_kk}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

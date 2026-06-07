import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/AppShell";
import { getMyProfile } from "@/lib/api/admin.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  beforeLoad: async () => {
    const me = await getMyProfile();
    if (!me.roles.includes("admin") && !me.permissions["manage_roles"]) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: PermissionsPage,
});

type Permission = {
  code: string;
  category: string;
  description_ru: string;
  description_kk: string;
};

function PermissionsPage() {
  const { data: permissions = [] } = useQuery({
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
      <PageHeader
        title="Справочник разрешений"
        description="Атомарные права доступа, используемые системой. Управляются через роли."
      />
      <PageBody>
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {cat}
              </h2>
              <div className="bg-card border border-border rounded-sm overflow-hidden">
                <table className="w-full data-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-2 w-72">Код</th>
                      <th className="text-left px-4 py-2">Описание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.code} className="border-t border-border">
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {p.code}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {p.description_ru}
                          <div className="text-xs text-muted-foreground">
                            {p.description_kk}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          {permissions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Справочник пуст. Запустите миграцию для загрузки базового набора.
            </p>
          )}
        </div>
      </PageBody>
    </>
  );
}

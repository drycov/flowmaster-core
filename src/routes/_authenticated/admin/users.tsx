import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers, setUserRole } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n, localized } from "@/lib/i18n";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

const ROLES = ["admin", "registrar", "approver", "signer", "archivist", "viewer"] as const;
type Role = typeof ROLES[number];

function UsersAdmin() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  
  const { data, isLoading, error } = useQuery({ 
    queryKey: ["users"], 
    queryFn: () => listUsers() 
  });
  
  const set = useMutation({
    mutationFn: (v: { user_id: string; role: Role; enabled: boolean }) => 
      setUserRole({ data: v }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["users"] }); 
      toast.success(t("users.roleUpdated") || "Роль обновлена");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  // Отображение загрузки
  if (isLoading) {
    return (
      <>
        <PageHeader title={t("nav.users")} />
        <PageBody>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  // Отображение ошибки
  if (error) {
    return (
      <>
        <PageHeader title={t("nav.users")} />
        <PageBody>
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {t("common.error")}: {error.message}
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("nav.users")} />
      <PageBody>
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          {/* Добавлен responsive wrapper для горизонтальной прокрутки */}
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2">ФИО</th>
                  <th className="text-left px-4 py-2">Email</th>
                  {ROLES.map((r) => (
                    <th key={r} className="text-center px-2 py-2 w-20 capitalize">
                      {t(`roles.${r}`) || r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2 text-sm font-medium">
                      {localized(u, locale, "full_name") || "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {u.email}
                    </td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        <Checkbox
                          checked={u.roles?.includes(r) || false}
                          onCheckedChange={(c) => set.mutate({ 
                            user_id: u.id, 
                            role: r, 
                            enabled: !!c 
                          })}
                          disabled={set.isPending && set.variables?.user_id === u.id && set.variables?.role === r}
                          aria-label={`${r} role for ${u.email}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Показать сообщение, если нет пользователей */}
                {(!data || data.length === 0) && (
                  <tr>
                    <td colSpan={2 + ROLES.length} className="text-center py-8 text-muted-foreground">
                      {t("users.noUsers") || "Пользователи не найдены"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageBody>
    </>
  );
}
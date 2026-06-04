import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers, setUserRole } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n, localized } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

const ROLES = ["admin", "registrar", "approver", "signer", "archivist", "viewer"] as const;

function UsersAdmin() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["users"], queryFn: () => listUsers() });
  const set = useMutation({
    mutationFn: (v: { user_id: string; role: typeof ROLES[number]; enabled: boolean }) => setUserRole({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Сохранено"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <PageHeader title={t("nav.users")} />
      <PageBody>
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <table className="w-full data-table">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2">ФИО</th>
              <th className="text-left px-4 py-2">Email</th>
              {ROLES.map((r) => <th key={r} className="text-center px-2 py-2 w-20">{r}</th>)}
            </tr></thead>
            <tbody>
              {(data ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2 text-sm">{localized(u, locale, "full_name") || "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{u.email}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 py-2 text-center">
                      <Checkbox
                        checked={u.roles.includes(r)}
                        onCheckedChange={(c) => set.mutate({ user_id: u.id, role: r, enabled: !!c })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}

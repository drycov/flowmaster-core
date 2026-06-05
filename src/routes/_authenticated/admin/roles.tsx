import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listRoleDefinitions, updateRoleDefinition } from "@/lib/api/org.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesPage,
});

const PERMISSIONS = [
  "manage_users",
  "manage_org",
  "manage_workflows",
  "manage_templates",
  "manage_nomenclature",
  "view_audit",
  "register_documents",
  "approve_documents",
  "sign_documents",
  "archive_documents",
] as const;

type Role = "admin" | "registrar" | "approver" | "signer" | "archivist" | "viewer";

type RoleDef = {
  role: Role;
  title_ru: string;
  title_kk: string;
  description_ru: string;
  description_kk: string;
  permissions: Record<string, boolean>;
};

function RolesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["roleDefs"], queryFn: () => listRoleDefinitions() });
  const [drafts, setDrafts] = useState<Record<string, RoleDef>>({});

  useEffect(() => {
    if (data) {
      const m: Record<string, RoleDef> = {};
      data.forEach((r) => {
        m[r.role] = {
          role: r.role as Role,
          title_ru: r.title_ru ?? "",
          title_kk: r.title_kk ?? "",
          description_ru: r.description_ru ?? "",
          description_kk: r.description_kk ?? "",
          permissions: (r.permissions as Record<string, boolean>) ?? {},
        };
      });
      setDrafts(m);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (rd: RoleDef) => updateRoleDefinition({ data: rd }),
    onSuccess: () => {
      toast.success(t("common.success"));
      qc.invalidateQueries({ queryKey: ["roleDefs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const set = (role: Role, patch: Partial<RoleDef>) => {
    setDrafts((d) => ({ ...d, [role]: { ...d[role], ...patch } }));
  };

  const togglePerm = (role: Role, perm: string, on: boolean) => {
    const cur = drafts[role];
    set(role, { permissions: { ...cur.permissions, [perm]: on } });
  };

  return (
    <>
      <PageHeader title={t("nav.roles")} description={t("roles.description")} />
      <PageBody>
        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 max-w-5xl">
            {(Object.keys(drafts) as Role[]).map((role) => {
              const rd = drafts[role];
              return (
                <div key={role} className="bg-card border border-border rounded-sm">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <Badge variant="outline" className="font-mono text-[10px]">{role}</Badge>
                      <span className="font-semibold text-sm">{rd.title_ru}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => save.mutate(rd)} disabled={save.isPending}>
                      <Save className="w-3.5 h-3.5 mr-1" /> {t("common.save")}
                    </Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{t("common.title")} (RU)</Label>
                          <Input value={rd.title_ru} onChange={(e) => set(role, { title_ru: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">{t("common.title")} (KK)</Label>
                          <Input value={rd.title_kk} onChange={(e) => set(role, { title_kk: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">{t("common.description")} (RU)</Label>
                        <Textarea rows={2} value={rd.description_ru} onChange={(e) => set(role, { description_ru: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">{t("common.description")} (KK)</Label>
                        <Textarea rows={2} value={rd.description_kk} onChange={(e) => set(role, { description_kk: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">{t("roles.permissions")}</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 border border-border rounded-sm p-3 bg-muted/20">
                        {PERMISSIONS.map((p) => (
                          <label key={p} className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-muted/40 px-1 rounded">
                            <Checkbox
                              checked={!!rd.permissions[p]}
                              onCheckedChange={(c) => togglePerm(role, p, !!c)}
                            />
                            <span className="font-mono text-[11px]">{p}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {t("roles.permissionsHint")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}

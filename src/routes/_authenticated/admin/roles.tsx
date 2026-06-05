import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { listRoleDefinitions, updateRoleDefinition } from "@/lib/api/org.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { Loader2, Save, ShieldCheck, RefreshCw } from "lucide-react";
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

  const { data, isLoading } = useQuery({
    queryKey: ["roleDefs"],
    queryFn: listRoleDefinitions,
  });

  const [drafts, setDrafts] = useState<Record<string, RoleDef>>({});
  const [dirtyRoles, setDirtyRoles] = useState<Set<Role>>(new Set());

  // Initialize drafts from server data
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
          permissions: { ...(r.permissions as Record<string, boolean>) ?? {} },
        };
      });
      setDrafts(m);
      setDirtyRoles(new Set());
    }
  }, [data]);

  const updateRole = useCallback((role: Role, patch: Partial<RoleDef>) => {
    setDrafts((prev) => ({
      ...prev,
      [role]: { ...prev[role], ...patch },
    }));
    setDirtyRoles((prev) => new Set(prev).add(role));
  }, []);

  const togglePermission = useCallback((role: Role, perm: string, checked: boolean) => {
    const current = drafts[role];
    if (!current) return;

    updateRole(role, {
      permissions: { ...current.permissions, [perm]: checked },
    });
  }, [drafts, updateRole]);

  const saveMutation = useMutation({
    mutationFn: (roleDef: RoleDef) => updateRoleDefinition({ data: roleDef }),
    onSuccess: (_, roleDef) => {
      toast.success(t("common.success"));
      setDirtyRoles((prev) => {
        const next = new Set(prev);
        next.delete(roleDef.role);
        return next;
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const resetRole = useCallback((role: Role) => {
    const original = data?.find((r) => r.role === role);
    if (original) {
      setDrafts((prev) => ({
        ...prev,
        [role]: {
          role: original.role as Role,
          title_ru: original.title_ru ?? "",
          title_kk: original.title_kk ?? "",
          description_ru: original.description_ru ?? "",
          description_kk: original.description_kk ?? "",
          permissions: { ...(original.permissions as Record<string, boolean>) ?? {} },
        },
      }));
      setDirtyRoles((prev) => {
        const next = new Set(prev);
        next.delete(role);
        return next;
      });
    }
  }, [data]);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("nav.roles")} />
        <PageBody>
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("nav.roles")} description={t("roles.description")} />

      <PageBody>
        <div className="space-y-6 max-w-5xl">
          {(Object.keys(drafts) as Role[]).map((role) => {
            const rd = drafts[role];
            const isDirty = dirtyRoles.has(role);
            const isSaving = saveMutation.isPending;

            return (
              <div key={role} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
                      {role}
                    </Badge>
                    <span className="font-semibold">{rd.title_ru || role}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetRole(role)}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Сбросить
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => saveMutation.mutate(rd)}
                      disabled={!isDirty || isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      {t("common.save")}
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Metadata */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>{t("common.title")} (RU)</Label>
                        <Input
                          value={rd.title_ru}
                          onChange={(e) => updateRole(role, { title_ru: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{t("common.title")} (KK)</Label>
                        <Input
                          value={rd.title_kk}
                          onChange={(e) => updateRole(role, { title_kk: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>{t("common.description")} (RU)</Label>
                      <Textarea
                        rows={3}
                        value={rd.description_ru}
                        onChange={(e) => updateRole(role, { description_ru: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>{t("common.description")} (KK)</Label>
                      <Textarea
                        rows={3}
                        value={rd.description_kk}
                        onChange={(e) => updateRole(role, { description_kk: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Permissions */}
                  <div>
                    <Label className="mb-3 block">{t("roles.permissions")}</Label>
                    <div className="border border-border rounded-lg p-4 bg-muted/30 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PERMISSIONS.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={!!rd.permissions[perm]}
                            onCheckedChange={(checked) => togglePermission(role, perm, !!checked)}
                          />
                          <span className="font-mono text-sm text-muted-foreground break-all">
                            {perm}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {t("roles.permissionsHint")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
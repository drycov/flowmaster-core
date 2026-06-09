import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Loader2, Pencil, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import {
  listTenants,
  provisionTenant,
  setTenantActive,
  updateTenant,
  type TenantListItem,
} from "@/lib/api/tenant.functions";

export function TenantsSettingsPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameKk, setNameKk] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminNameRu, setAdminNameRu] = useState("");
  const [adminNameKk, setAdminNameKk] = useState("");
  const [provisionMaxUsers, setProvisionMaxUsers] = useState("");
  const [editTenant, setEditTenant] = useState<TenantListItem | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editNameRu, setEditNameRu] = useState("");
  const [editNameKk, setEditNameKk] = useState("");
  const [editMaxUsers, setEditMaxUsers] = useState("");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: listTenants,
  });

  const provisionMutation = useMutation({
    mutationFn: () =>
      provisionTenant({
        data: {
          slug,
          name_ru: nameRu,
          name_kk: nameKk,
          admin_email: adminEmail,
          admin_password: adminPassword,
          admin_full_name_ru: adminNameRu,
          admin_full_name_kk: adminNameKk,
          max_users: provisionMaxUsers.trim() ? Number.parseInt(provisionMaxUsers, 10) : null,
        },
      }),
    onSuccess: (result) => {
      toast.success(t("settings.tenants.provisionSuccess"));
      qc.invalidateQueries({ queryKey: ["tenants"] });
      setShowForm(false);
      setSlug("");
      setNameRu("");
      setNameKk("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminNameRu("");
      setAdminNameKk("");
      setProvisionMaxUsers("");
      if (result.slug) {
        toast.info(t("settings.tenants.provisionSlugHint").replace("{slug}", result.slug));
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const activeMutation = useMutation({
    mutationFn: (input: { organization_id: string; is_active: boolean }) =>
      setTenantActive({ data: input }),
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(
        vars.is_active
          ? t("settings.tenants.activateSuccess")
          : t("settings.tenants.deactivateSuccess"),
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editTenant) throw new Error("No tenant");
      return updateTenant({
        data: {
          organization_id: editTenant.id,
          slug: editSlug,
          name_ru: editNameRu,
          name_kk: editNameKk,
          max_users: editMaxUsers.trim() ? Number.parseInt(editMaxUsers, 10) : null,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("settings.tenants.updateSuccess"));
      qc.invalidateQueries({ queryKey: ["tenants"] });
      setEditTenant(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const openEdit = (tenant: TenantListItem) => {
    setEditTenant(tenant);
    setEditSlug(tenant.slug ?? "");
    setEditNameRu(tenant.name_ru);
    setEditNameKk(tenant.name_kk);
    setEditMaxUsers(tenant.max_users != null ? String(tenant.max_users) : "");
  };

  const formatQuota = (tenant: TenantListItem) => {
    if (tenant.max_users == null) return t("settings.tenants.quotaUnlimited");
    return `${tenant.user_count} / ${tenant.max_users}`;
  };

  const resetForm = () => {
    setSlug("");
    setNameRu("");
    setNameKk("");
    setAdminEmail("");
    setAdminPassword("");
    setAdminNameRu("");
    setAdminNameKk("");
    setProvisionMaxUsers("");
    setShowForm(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-5 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <h2 className="font-semibold">{t("settings.tenants.title")}</h2>
          </div>
          <Button
            type="button"
            size="sm"
            variant={showForm ? "outline" : "default"}
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
          >
            {showForm ? (
              t("common.cancel")
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" />
                {t("settings.tenants.add")}
              </>
            )}
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{t("settings.tenants.description")}</p>
          <p className="text-xs text-muted-foreground">{t("settings.tenants.platformHint")}</p>

          {(tenants ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("settings.tenants.empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("settings.tenants.col.slug")}</th>
                    <th className="px-3 py-2 font-medium">{t("settings.tenants.col.name")}</th>
                    <th className="px-3 py-2 font-medium">{t("settings.tenants.col.users")}</th>
                    <th className="px-3 py-2 font-medium">{t("settings.tenants.col.quota")}</th>
                    <th className="px-3 py-2 font-medium">{t("settings.tenants.col.mode")}</th>
                    <th className="px-3 py-2 font-medium">{t("settings.tenants.col.status")}</th>
                    <th className="px-3 py-2 font-medium">{t("settings.tenants.col.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(tenants ?? []).map((tenant) => (
                    <tr key={tenant.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{tenant.slug ?? "—"}</td>
                      <td className="px-3 py-2">{tenant.name_ru}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {tenant.user_count}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatQuota(tenant)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{tenant.tenant_mode}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={tenant.is_active ? "default" : "outline"}>
                          {tenant.is_active
                            ? t("settings.tenants.statusActive")
                            : t("settings.tenants.statusInactive")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(tenant)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">{t("settings.tenants.edit")}</span>
                          </Button>
                          <Switch
                            checked={tenant.is_active}
                            disabled={activeMutation.isPending}
                            onCheckedChange={(checked) =>
                              activeMutation.mutate({
                                organization_id: tenant.id,
                                is_active: checked,
                              })
                            }
                            aria-label={t("settings.tenants.toggleActive")}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editTenant} onOpenChange={(open) => !open && setEditTenant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.tenants.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("settings.tenants.slug")}</Label>
              <Input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value.toLowerCase())}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.tenants.nameRu")}</Label>
              <Input value={editNameRu} onChange={(e) => setEditNameRu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.tenants.nameKk")}</Label>
              <Input value={editNameKk} onChange={(e) => setEditNameKk(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.tenants.maxUsers")}</Label>
              <Input
                type="number"
                min={1}
                value={editMaxUsers}
                onChange={(e) => setEditMaxUsers(e.target.value)}
                placeholder={t("settings.tenants.quotaUnlimited")}
              />
              <p className="text-xs text-muted-foreground">{t("settings.tenants.maxUsersHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTenant(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                updateMutation.isPending ||
                !editSlug.trim() ||
                !editNameRu.trim() ||
                !editNameKk.trim()
              }
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showForm && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/50 px-5 py-3">
            <h3 className="font-semibold">{t("settings.tenants.formTitle")}</h3>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("settings.tenants.slug")}</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="acme"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.tenants.nameRu")}</Label>
                <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("settings.tenants.nameKk")}</Label>
                <Input value={nameKk} onChange={(e) => setNameKk(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("settings.tenants.maxUsers")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={provisionMaxUsers}
                  onChange={(e) => setProvisionMaxUsers(e.target.value)}
                  placeholder={t("settings.tenants.quotaUnlimited")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.tenants.maxUsersHint")}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">{t("settings.tenants.adminSection")}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("auth.email")}</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("auth.fullnameRu")}</Label>
                  <Input value={adminNameRu} onChange={(e) => setAdminNameRu(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("auth.fullnameKk")}</Label>
                  <Input value={adminNameKk} onChange={(e) => setAdminNameKk(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("auth.password")}</Label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={
                  provisionMutation.isPending ||
                  !slug.trim() ||
                  !nameRu.trim() ||
                  !nameKk.trim() ||
                  !adminEmail.trim() ||
                  !adminPassword ||
                  !adminNameRu.trim() ||
                  !adminNameKk.trim()
                }
                onClick={() => provisionMutation.mutate()}
              >
                {provisionMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {t("settings.tenants.provision")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

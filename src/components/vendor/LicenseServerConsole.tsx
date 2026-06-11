import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Ban,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import {
  generateVendorLicenseKeyFn,
  getLicenseServerAdminOverview,
  listLicenseServerActivationsFn,
  listLicenseServerKeysFn,
  listLicenseServerProvisionsFn,
  provisionInstallationFn,
  registerLicenseServerKeyFn,
  revokeLicenseServerFn,
} from "@/lib/api/license-server-admin.functions";
import { planLabel } from "@/lib/license/plans";
import { LICENSE_PLANS, type LicensePlan } from "@/lib/license/types";
import { cn } from "@/lib/utils";

export function LicenseServerConsole({ onLogout }: { onLogout?: () => void }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState("provisions");
  const [registerKey, setRegisterKey] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showProvision, setShowProvision] = useState(false);
  const [genPlan, setGenPlan] = useState<LicensePlan>("professional");
  const [genCustomer, setGenCustomer] = useState("");
  const [genInstallationId, setGenInstallationId] = useState("");
  const [genMaxUsers, setGenMaxUsers] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{
    type: "key" | "activation";
    keyId?: string;
    keyHash?: string;
    installationId?: string;
    label: string;
  } | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const overviewQuery = useQuery({
    queryKey: ["license-server-overview"],
    queryFn: getLicenseServerAdminOverview,
  });

  const keysQuery = useQuery({
    queryKey: ["license-server-keys"],
    queryFn: () => listLicenseServerKeysFn({ data: { limit: 100, status: "all" } }),
  });

  const activationsQuery = useQuery({
    queryKey: ["license-server-activations"],
    queryFn: () => listLicenseServerActivationsFn({ data: { limit: 100, status: "all" } }),
  });

  const provisionsQuery = useQuery({
    queryKey: ["license-server-provisions"],
    queryFn: () => listLicenseServerProvisionsFn({ data: { limit: 100, status: "all" } }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["license-server-overview"] });
    qc.invalidateQueries({ queryKey: ["license-server-keys"] });
    qc.invalidateQueries({ queryKey: ["license-server-activations"] });
    qc.invalidateQueries({ queryKey: ["license-server-provisions"] });
  };

  const registerMutation = useMutation({
    mutationFn: () => registerLicenseServerKeyFn({ data: { license_key: registerKey.trim() } }),
    onSuccess: () => {
      toast.success(t("licenseServer.registerSuccess"));
      setRegisterKey("");
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateVendorLicenseKeyFn({
        data: {
          plan: genPlan,
          customer: genCustomer.trim(),
          installation_id: genInstallationId.trim(),
          max_users: genMaxUsers.trim() ? Number.parseInt(genMaxUsers, 10) : undefined,
          auto_register: true,
        },
      }),
    onSuccess: (result) => {
      setGeneratedKey(result.license_key);
      toast.success(t("licenseServer.generateSuccess"));
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const provisionMutation = useMutation({
    mutationFn: () =>
      provisionInstallationFn({
        data: {
          plan: genPlan,
          customer: genCustomer.trim(),
          installation_id: genInstallationId.trim(),
          max_users: genMaxUsers.trim() ? Number.parseInt(genMaxUsers, 10) : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("licenseServer.provisionSuccess"));
      setShowProvision(false);
      setGenCustomer("");
      setGenInstallationId("");
      setGenMaxUsers("");
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const revokeMutation = useMutation({
    mutationFn: () => {
      if (!revokeTarget) throw new Error("No target");
      return revokeLicenseServerFn({
        data: {
          key_id: revokeTarget.keyId,
          key_hash: revokeTarget.keyHash,
          installation_id: revokeTarget.installationId,
          reason: revokeReason.trim() || t("licenseServer.revokeDefaultReason"),
        },
      });
    },
    onSuccess: (result) => {
      toast.success(
        t("licenseServer.revokeSuccess")
          .replace("{keys}", String(result.revoked_keys))
          .replace("{acts}", String(result.revoked_activations)),
      );
      setRevokeTarget(null);
      setRevokeReason("");
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const overview = overviewQuery.data;
  const dateLocale = locale === "kk" ? "kk-KZ" : "ru-RU";

  return (
    <>
      <PageHeader
        title={t("licenseServer.title")}
        description={t("licenseServer.description")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => invalidateAll()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("licenseServer.refresh")}
            </Button>
            {onLogout ? (
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t("vendorAuth.logout")}
              </Button>
            ) : null}
          </div>
        }
      />
      <PageBody>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<KeyRound className="h-4 w-4" />}
            label={t("licenseServer.stats.keys")}
            value={overview ? String(overview.keys_total) : "—"}
            detail={
              overview
                ? t("licenseServer.stats.keysDetail")
                    .replace("{active}", String(overview.keys_active))
                    .replace("{revoked}", String(overview.keys_revoked))
                : ""
            }
            loading={overviewQuery.isLoading}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label={t("licenseServer.stats.activations")}
            value={overview ? String(overview.activations_total) : "—"}
            detail={
              overview
                ? t("licenseServer.stats.activationsDetail")
                    .replace("{active}", String(overview.activations_active))
                    .replace("{revoked}", String(overview.activations_revoked))
                : ""
            }
            loading={overviewQuery.isLoading}
          />
          <StatCard
            icon={<Server className="h-4 w-4" />}
            label={t("licenseServer.stats.role")}
            value={t("licenseServer.stats.vendor")}
            detail={t("licenseServer.stats.localHint")}
          />
          <StatCard
            icon={<Shield className="h-4 w-4" />}
            label={t("licenseServer.stats.checkedAt")}
            value={
              overview?.checked_at
                ? new Date(overview.checked_at).toLocaleTimeString(dateLocale)
                : "—"
            }
            detail={t("licenseServer.stats.checkedAtHint")}
            loading={overviewQuery.isLoading}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="provisions">{t("licenseServer.tabs.provisions")}</TabsTrigger>
            <TabsTrigger value="keys">{t("licenseServer.tabs.keys")}</TabsTrigger>
            <TabsTrigger value="activations">{t("licenseServer.tabs.activations")}</TabsTrigger>
            <TabsTrigger value="register">{t("licenseServer.tabs.register")}</TabsTrigger>
          </TabsList>

          <TabsContent value="provisions" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowProvision(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("licenseServer.provisionBtn")}
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("licenseServer.provisionsTitle")}</CardTitle>
                <CardDescription>{t("licenseServer.provisionsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {provisionsQuery.isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("licenseServer.col.customer")}</TableHead>
                        <TableHead>{t("licenseServer.col.installationId")}</TableHead>
                        <TableHead>{t("licenseServer.col.plan")}</TableHead>
                        <TableHead>{t("licenseServer.col.seats")}</TableHead>
                        <TableHead>{t("licenseServer.col.expires")}</TableHead>
                        <TableHead>{t("licenseServer.col.status")}</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(provisionsQuery.data?.items ?? []).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.customer_name || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.installation_id}</TableCell>
                          <TableCell>{planLabel(row.plan, locale)}</TableCell>
                          <TableCell>{row.max_users}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.expires_at
                              ? new Date(row.expires_at).toLocaleDateString(dateLocale)
                              : t("license.perpetual")}
                          </TableCell>
                          <TableCell>{statusBadge(row.status, t)}</TableCell>
                          <TableCell>
                            {row.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setRevokeTarget({
                                    type: "activation",
                                    installationId: row.installation_id,
                                    label: row.installation_id,
                                  })
                                }
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!provisionsQuery.data?.items.length && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            {t("licenseServer.emptyProvisions")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keys" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowGenerate(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("licenseServer.generateBtn")}
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("licenseServer.keysTitle")}</CardTitle>
                <CardDescription>{t("licenseServer.keysDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {keysQuery.isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("licenseServer.col.customer")}</TableHead>
                        <TableHead>{t("licenseServer.col.plan")}</TableHead>
                        <TableHead>{t("licenseServer.col.keyHash")}</TableHead>
                        <TableHead>{t("licenseServer.col.seats")}</TableHead>
                        <TableHead>{t("licenseServer.col.activations")}</TableHead>
                        <TableHead>{t("licenseServer.col.expires")}</TableHead>
                        <TableHead>{t("licenseServer.col.status")}</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(keysQuery.data?.items ?? []).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.customer_name || "—"}
                          </TableCell>
                          <TableCell>{planLabel(row.plan, locale)}</TableCell>
                          <TableCell className="font-mono text-xs">{row.key_hash_short}</TableCell>
                          <TableCell>{row.max_users}</TableCell>
                          <TableCell>
                            {row.active_activations}/{row.max_activations}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.expires_at
                              ? new Date(row.expires_at).toLocaleDateString(dateLocale)
                              : t("license.perpetual")}
                          </TableCell>
                          <TableCell>{statusBadge(row.status, t)}</TableCell>
                          <TableCell>
                            {row.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setRevokeTarget({
                                    type: "key",
                                    keyId: row.id,
                                    label: row.customer_name || row.key_hash_short,
                                  })
                                }
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!keysQuery.data?.items.length && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                            {t("licenseServer.emptyKeys")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("licenseServer.activationsTitle")}</CardTitle>
                <CardDescription>{t("licenseServer.activationsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {activationsQuery.isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("licenseServer.col.customer")}</TableHead>
                        <TableHead>{t("licenseServer.col.installationId")}</TableHead>
                        <TableHead>{t("licenseServer.col.hostname")}</TableHead>
                        <TableHead>{t("licenseServer.col.version")}</TableHead>
                        <TableHead>{t("licenseServer.col.lastSeen")}</TableHead>
                        <TableHead>{t("licenseServer.col.status")}</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(activationsQuery.data?.items ?? []).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.customer_name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{row.installation_id}</TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm">
                            {row.hostname || "—"}
                          </TableCell>
                          <TableCell className="text-sm">{row.app_version || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(row.last_seen_at).toLocaleString(dateLocale)}
                          </TableCell>
                          <TableCell>{statusBadge(row.status, t)}</TableCell>
                          <TableCell>
                            {row.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setRevokeTarget({
                                    type: "activation",
                                    installationId: row.installation_id,
                                    label: row.installation_id,
                                  })
                                }
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!activationsQuery.data?.items.length && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            {t("licenseServer.emptyActivations")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("licenseServer.registerTitle")}</CardTitle>
                <CardDescription>{t("licenseServer.registerDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-xl">
                <div className="space-y-1.5">
                  <Label htmlFor="register-key">{t("license.key")}</Label>
                  <Textarea
                    id="register-key"
                    value={registerKey}
                    onChange={(e) => setRegisterKey(e.target.value)}
                    placeholder="FM1...."
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  disabled={registerKey.trim().length < 20 || registerMutation.isPending}
                  onClick={() => registerMutation.mutate()}
                >
                  {registerMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("licenseServer.registerBtn")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("licenseServer.generateTitle")}</DialogTitle>
          </DialogHeader>
          {generatedKey ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("licenseServer.generatedHint")}</p>
              <Textarea readOnly value={generatedKey} rows={4} className="font-mono text-xs" />
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(generatedKey);
                  toast.success(t("licenseServer.copied"));
                }}
              >
                {t("licenseServer.copyKey")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("licenseServer.field.plan")}</Label>
                <Select value={genPlan} onValueChange={(v) => setGenPlan(v as LicensePlan)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LICENSE_PLANS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {planLabel(p, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("licenseServer.field.customer")}</Label>
                <Input value={genCustomer} onChange={(e) => setGenCustomer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("licenseServer.field.installationId")}</Label>
                <Input
                  value={genInstallationId}
                  onChange={(e) => setGenInstallationId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t("licenseServer.field.installationIdHint")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("licenseServer.field.maxUsers")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={genMaxUsers}
                  onChange={(e) => setGenMaxUsers(e.target.value)}
                  placeholder={t("licenseServer.field.maxUsersOptional")}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {generatedKey ? (
              <Button
                onClick={() => {
                  setGeneratedKey(null);
                  setShowGenerate(false);
                  setGenCustomer("");
                  setGenInstallationId("");
                  setGenMaxUsers("");
                }}
              >
                {t("licenseServer.done")}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowGenerate(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  disabled={
                    !genInstallationId.trim() ||
                    generateMutation.isPending
                  }
                  onClick={() => generateMutation.mutate()}
                >
                  {generateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("licenseServer.generateBtn")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProvision} onOpenChange={setShowProvision}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("licenseServer.provisionTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("licenseServer.field.plan")}</Label>
              <Select value={genPlan} onValueChange={(v) => setGenPlan(v as LicensePlan)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_PLANS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {planLabel(p, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("licenseServer.field.customer")}</Label>
              <Input value={genCustomer} onChange={(e) => setGenCustomer(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("licenseServer.field.installationId")}</Label>
              <Input
                value={genInstallationId}
                onChange={(e) => setGenInstallationId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t("licenseServer.field.installationIdHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("licenseServer.field.maxUsers")}</Label>
              <Input
                type="number"
                min={1}
                value={genMaxUsers}
                onChange={(e) => setGenMaxUsers(e.target.value)}
                placeholder={t("licenseServer.field.maxUsersOptional")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProvision(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!genInstallationId.trim() || provisionMutation.isPending}
              onClick={() => provisionMutation.mutate()}
            >
              {provisionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("licenseServer.provisionBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("licenseServer.revokeTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("licenseServer.revokeDesc").replace("{target}", revokeTarget?.label ?? "")}
          </p>
          <div className="space-y-1.5">
            <Label>{t("licenseServer.field.reason")}</Label>
            <Input
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder={t("licenseServer.revokeDefaultReason")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() => revokeMutation.mutate()}
            >
              {revokeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("licenseServer.revokeBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function statusBadge(status: string, t: (k: string) => string) {
  const active = status === "active";
  return (
    <Badge variant={active ? "default" : "secondary"} className={cn(!active && "opacity-80")}>
      {active ? t("licenseServer.status.active") : t("licenseServer.status.revoked")}
    </Badge>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : value}
        </p>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

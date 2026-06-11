import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Cloud,
  KeyRound,
  Loader2,
  RefreshCw,
  Shield,
  Users,
  Calendar,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import {
  activateLicenseKey,
  getInstallationInfo,
  getLicenseServerConfig,
  getLicenseStatus,
  setLicenseSuspended,
  syncLicenseNow,
} from "@/lib/api/license.functions";
import { featureLabel, planLabel } from "@/lib/license/plans";
import { LICENSE_FEATURES, type LicenseStatus } from "@/lib/license/types";

const STATUS_STYLES: Record<LicenseStatus, string> = {
  active: "bg-[oklch(0.94_0.08_145)] text-[oklch(0.32_0.14_145)]",
  grace: "bg-[oklch(0.95_0.05_75)] text-[oklch(0.4_0.15_75)]",
  expired: "bg-[oklch(0.95_0.06_27)] text-[oklch(0.4_0.18_27)]",
  suspended: "bg-muted text-muted-foreground",
};

export function LicenseSettingsPanel({ canManage = true }: { canManage?: boolean }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [licenseKey, setLicenseKey] = useState("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["license-status"],
    queryFn: getLicenseStatus,
  });

  const { data: installInfo } = useQuery({
    queryKey: ["installation-info"],
    queryFn: getInstallationInfo,
  });

  const { data: serverConfig } = useQuery({
    queryKey: ["license-server-config"],
    queryFn: getLicenseServerConfig,
  });

  const activateMutation = useMutation({
    mutationFn: (key: string) => activateLicenseKey({ data: { license_key: key } }),
    onSuccess: () => {
      toast.success(t("license.activated"));
      setLicenseKey("");
      qc.invalidateQueries({ queryKey: ["license-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncLicenseNow(),
    onSuccess: () => {
      toast.success(t("license.syncSuccess"));
      qc.invalidateQueries({ queryKey: ["license-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const suspendMutation = useMutation({
    mutationFn: (suspended: boolean) => setLicenseSuspended({ data: { suspended } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["license-status"] });
      toast.success(t("common.success"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (isLoading || !status) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const seatPct =
    status.max_users > 0 ? Math.min(100, (status.active_users / status.max_users) * 100) : 0;
  const seatsFull = status.seats_available <= 0;
  const seatsWarning = !seatsFull && seatPct >= 80;
  const trialExpiring =
    status.plan === "trial" && status.days_remaining !== null && status.days_remaining <= 7;
  const expiresLabel = status.expires_at
    ? new Date(status.expires_at).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU")
    : t("license.perpetual");

  const isOnline = status.activation_mode === "online";
  const isCloud = !!serverConfig?.cloud_license;
  const lastSyncLabel = status.last_sync_at
    ? new Date(status.last_sync_at).toLocaleString(locale === "kk" ? "kk-KZ" : "ru-RU")
    : "—";

  return (
    <div className="space-y-6">
      {serverConfig?.server_configured ? (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Cloud className="h-4 w-4" />
              {t("license.online.title")}
            </div>
            <Badge variant="outline">
              {t(`license.online.mode.${serverConfig.mode}` as "license.online.mode.online")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {isCloud ? t("license.cloud.description") : t("license.online.description")}
          </p>
          {(isOnline || isCloud) && (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {status.offline_mode ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 sm:col-span-2">
                  {t("license.offline.description")}
                </p>
              ) : null}
              <div>
                <span className="text-muted-foreground">{t("license.online.lastSync")}: </span>
                <span>{lastSyncLabel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("license.online.syncStatus")}: </span>
                <span className={status.last_sync_ok ? "text-emerald-600" : "text-destructive"}>
                  {status.last_sync_ok ? t("license.online.syncOk") : t("license.online.syncFail")}
                </span>
              </div>
              {status.last_sync_error ? (
                <p className="text-xs text-destructive sm:col-span-2">{status.last_sync_error}</p>
              ) : null}
              {status.server_revoked ? (
                <p className="text-xs text-destructive sm:col-span-2">
                  {t("license.online.revoked")}
                </p>
              ) : null}
              {status.sync_stale && !status.offline_mode ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 sm:col-span-2">
                  {t("license.online.syncStale").replace(
                    "{h}",
                    String(status.offline_grace_hours ?? 72),
                  )}
                </p>
              ) : null}
            </div>
          )}
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("license.online.syncNow")}
            </Button>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          label={t("license.plan")}
          value={planLabel(status.plan, locale)}
          badge={
            <Badge variant="outline" className={STATUS_STYLES[status.status]}>
              {t(`license.status.${status.status}`)}
            </Badge>
          }
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label={t("license.seats")}
          value={`${status.active_users} / ${status.max_users}`}
        />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label={t("license.expires")}
          value={expiresLabel}
          hint={
            status.days_remaining !== null
              ? t("license.daysLeft").replace("{n}", String(status.days_remaining))
              : undefined
          }
        />
        {status.customer_name ? (
          <StatCard
            icon={<Building2 className="h-4 w-4" />}
            label={t("license.customer")}
            value={status.customer_name}
          />
        ) : null}
      </div>

      {canManage && (
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-5">
          <div>
            <p className="text-sm font-medium">{t("license.suspend")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("license.suspendHint")}</p>
          </div>
          <Switch
            checked={status.status === "suspended"}
            disabled={suspendMutation.isPending}
            onCheckedChange={(checked) => suspendMutation.mutate(checked)}
          />
        </div>
      )}

      <div className="space-y-3 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("license.seatUsage")}</span>
          <span className="font-medium">
            {status.seats_available} {t("license.seatsFree")}
          </span>
        </div>
        <Progress
          value={seatPct}
          className={`h-2 ${seatsFull ? "[&>div]:bg-destructive" : seatsWarning ? "[&>div]:bg-amber-500" : ""}`}
        />
        {seatsFull ? (
          <p className="text-xs text-destructive">{t("license.seatsFull")}</p>
        ) : seatsWarning ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("license.seatsWarning").replace("{n}", String(Math.round(seatPct)))}
          </p>
        ) : null}
        {trialExpiring && status.days_remaining !== null ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("license.trialExpiring").replace("{n}", String(status.days_remaining))}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b bg-muted/50 px-5 py-3 text-sm font-semibold">
          {t("license.features")}
        </div>
        <ul className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2">
          {LICENSE_FEATURES.map((f) => {
            const enabled = !!status.features[f];
            return (
              <li key={f} className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                />
                <span className={enabled ? "" : "text-muted-foreground line-through"}>
                  {featureLabel(f, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {installInfo?.installation_id ? (
        <div className="space-y-1 rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          <div className="font-mono">
            <span className="font-sans font-medium text-foreground">
              {t("license.installationId")}:{" "}
            </span>
            {installInfo.installation_id}
          </div>
          <p className="font-sans text-[11px]">
            {installInfo.source === "supabase_project"
              ? t("license.installationAuto")
              : t("license.installationPersisted")}
          </p>
        </div>
      ) : null}

      {canManage && !isCloud && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4" />
            {t("license.activate")}
          </div>
          <p className="text-sm text-muted-foreground">
            {serverConfig?.mode === "online"
              ? t("license.activateHintOnline")
              : t("license.activateHint")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="license-key">{t("license.key")}</Label>
            <Input
              id="license-key"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="FM1...."
              className="font-mono text-sm"
            />
          </div>
          <Button
            onClick={() => activateMutation.mutate(licenseKey)}
            disabled={!licenseKey.trim() || activateMutation.isPending}
          >
            {activateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("license.activateBtn")}
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  badge,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">{value}</span>
        {badge}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

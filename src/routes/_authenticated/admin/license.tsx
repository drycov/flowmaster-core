import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Loader2, Shield, Users, Calendar, Building2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n";
import { requireAnyPermission } from "@/lib/auth/route-guards";
import {
  activateLicenseKey,
  getInstallationInfo,
  getLicenseStatus,
  setLicenseSuspended,
} from "@/lib/api/license.functions";
import { Switch } from "@/components/ui/switch";
import { featureLabel, planLabel } from "@/lib/license/plans";
import { LICENSE_FEATURES, type LicenseStatus } from "@/lib/license/types";

export const Route = createFileRoute("/_authenticated/admin/license")({
  beforeLoad: () => requireAnyPermission("manage_license"),
  component: LicensePage,
});

const STATUS_STYLES: Record<LicenseStatus, string> = {
  active: "bg-[oklch(0.94_0.08_145)] text-[oklch(0.32_0.14_145)]",
  grace: "bg-[oklch(0.95_0.05_75)] text-[oklch(0.4_0.15_75)]",
  expired: "bg-[oklch(0.95_0.06_27)] text-[oklch(0.4_0.18_27)]",
  suspended: "bg-muted text-muted-foreground",
};

function LicensePage() {
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

  const activateMutation = useMutation({
    mutationFn: (key: string) => activateLicenseKey({ data: { license_key: key } }),
    onSuccess: () => {
      toast.success(t("license.activated"));
      setLicenseKey("");
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
      <>
        <PageHeader title={t("nav.license")} />
        <PageBody>
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  const seatPct = Math.min(100, (status.active_users / status.max_users) * 100);
  const expiresLabel = status.expires_at
    ? new Date(status.expires_at).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU")
    : t("license.perpetual");

  return (
    <>
      <PageHeader
        title={t("nav.license")}
        description={t("license.description")}
      />

      <PageBody className="max-w-4xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            icon={<Shield className="w-4 h-4" />}
            label={t("license.plan")}
            value={planLabel(status.plan, locale)}
            badge={
              <Badge variant="outline" className={STATUS_STYLES[status.status]}>
                {t(`license.status.${status.status}`)}
              </Badge>
            }
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label={t("license.seats")}
            value={`${status.active_users} / ${status.max_users}`}
          />
          <StatCard
            icon={<Calendar className="w-4 h-4" />}
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
              icon={<Building2 className="w-4 h-4" />}
              label={t("license.customer")}
              value={status.customer_name}
            />
          ) : null}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">{t("license.suspend")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("license.suspendHint")}</p>
          </div>
          <Switch
            checked={status.status === "suspended"}
            disabled={suspendMutation.isPending}
            onCheckedChange={(checked) => suspendMutation.mutate(checked)}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("license.seatUsage")}</span>
            <span className="font-medium">
              {status.seats_available} {t("license.seatsFree")}
            </span>
          </div>
          <Progress value={seatPct} className="h-2" />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/50 font-semibold text-sm">
            {t("license.features")}
          </div>
          <ul className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LICENSE_FEATURES.map((f) => {
              const enabled = !!status.features[f];
              return (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-2 h-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
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
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 space-y-1">
            <div className="font-mono">
              <span className="font-sans font-medium text-foreground">{t("license.installationId")}: </span>
              {installInfo.installation_id}
            </div>
            <p className="font-sans text-[11px]">
              {installInfo.source === "supabase_project"
                ? t("license.installationAuto")
                : t("license.installationPersisted")}
            </p>
          </div>
        ) : null}

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="w-4 h-4" />
            {t("license.activate")}
          </div>
          <p className="text-sm text-muted-foreground">{t("license.activateHint")}</p>
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
            {activateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("license.activateBtn")}
          </Button>
        </div>
      </PageBody>
    </>
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
    <div className="bg-card border border-border rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
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

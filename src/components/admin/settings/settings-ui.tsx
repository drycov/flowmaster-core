import { Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SystemSettings } from "@/lib/auth/policy";

export type SettingsPatchFn = <K extends keyof SystemSettings>(
  section: K,
  key: keyof SystemSettings[K],
  value: SystemSettings[K][keyof SystemSettings[K]],
) => void;

export function StatusCard({
  label,
  detail,
  enabled,
  neutral,
}: {
  label: string;
  detail: string;
  enabled: boolean;
  neutral?: boolean;
}) {
  const Icon = neutral ? null : enabled ? CheckCircle2 : XCircle;
  const tone = neutral
    ? "text-muted-foreground"
    : enabled
      ? "text-emerald-600"
      : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 ${tone}`} />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

export function QuickLink({
  to,
  search,
  icon,
  label,
}: {
  to: string;
  search?: { tab: string };
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to={to} search={search}>
        {icon}
        <span className="ml-2">{label}</span>
      </Link>
    </Button>
  );
}

export function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-5 py-3">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </div>
  );
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

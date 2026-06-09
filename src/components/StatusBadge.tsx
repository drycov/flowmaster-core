import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

const styles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  in_review: "bg-[oklch(0.93_0.06_250)] text-[oklch(0.32_0.13_250)] border-[oklch(0.78_0.08_250)]",
  approved: "bg-[oklch(0.94_0.08_145)] text-[oklch(0.32_0.14_145)] border-[oklch(0.7_0.12_145)]",
  signed: "bg-[oklch(0.92_0.1_150)] text-[oklch(0.28_0.15_150)] border-[oklch(0.55_0.15_145)]",
  rejected: "bg-[oklch(0.95_0.06_27)] text-[oklch(0.4_0.18_27)] border-[oklch(0.55_0.21_27)]",
  archived: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border line-through",
  returned: "bg-[oklch(0.95_0.05_75)] text-[oklch(0.4_0.15_75)] border-[oklch(0.72_0.13_75)]",
  returned_for_revision: "bg-[oklch(0.95_0.05_75)] text-[oklch(0.4_0.15_75)] border-[oklch(0.72_0.13_75)]",
  pending: "bg-[oklch(0.95_0.05_75)] text-[oklch(0.4_0.15_75)] border-[oklch(0.72_0.13_75)]",
  in_progress: "bg-[oklch(0.93_0.06_250)] text-[oklch(0.32_0.13_250)] border-[oklch(0.78_0.08_250)]",
  completed: "bg-[oklch(0.94_0.08_145)] text-[oklch(0.32_0.14_145)] border-[oklch(0.7_0.12_145)]",
  escalated: "bg-[oklch(0.95_0.06_27)] text-[oklch(0.4_0.18_27)] border-[oklch(0.55_0.21_27)]",
};

export function StatusBadge({ status, kind = "status" }: { status: string; kind?: "status" | "sla" | "task" }) {
  const { t } = useI18n();
  const cls = styles[status] || "bg-muted text-muted-foreground";
  const key = `${kind === "sla" ? "sla" : "status"}.${status}` as Parameters<typeof t>[0];
  let label: string;
  try {
    label = t(key);
  } catch {
    label = status;
  }
  if (label === key) label = status;
  return (
    <Badge variant="outline" className={`${cls} font-medium text-[11px] uppercase tracking-wide`}>
      {label}
    </Badge>
  );
}

export function SlaBadge({ sla }: { sla: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    ok: "bg-[oklch(0.94_0.08_145)] text-[oklch(0.32_0.14_145)] border-[oklch(0.7_0.12_145)]",
    warning: "bg-[oklch(0.95_0.08_75)] text-[oklch(0.4_0.15_75)] border-[oklch(0.72_0.13_75)]",
    overdue: "bg-[oklch(0.95_0.06_27)] text-[oklch(0.4_0.18_27)] border-[oklch(0.55_0.21_27)]",
  };
  const labels: Record<string, string> = {
    ok: t("sla.ok"),
    warning: t("sla.warning"),
    overdue: t("sla.overdue"),
  };
  return (
    <Badge variant="outline" className={`${map[sla] ?? ""} text-[11px] uppercase tracking-wide`}>
      {labels[sla] ?? sla}
    </Badge>
  );
}

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const key = `hr.leave.status.${status}`;
  const label = t(key) !== key ? t(key) : status;
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{label}</Badge>;
}

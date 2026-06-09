import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

type SubstitutionStatus = "active" | "upcoming" | "expired" | "inactive";

export function getSubstitutionStatus(
  isActive: boolean,
  validFrom: string,
  validUntil: string,
  now = new Date(),
): SubstitutionStatus {
  if (!isActive) return "inactive";
  const from = new Date(validFrom);
  const until = new Date(validUntil);
  if (now < from) return "upcoming";
  if (now > until) return "expired";
  return "active";
}

const VARIANT: Record<SubstitutionStatus, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  upcoming: "secondary",
  expired: "outline",
  inactive: "destructive",
};

export function SubstitutionStatusBadge({
  isActive,
  validFrom,
  validUntil,
}: {
  isActive: boolean;
  validFrom: string;
  validUntil: string;
}) {
  const { t } = useI18n();
  const status = getSubstitutionStatus(isActive, validFrom, validUntil);
  return (
    <Badge variant={VARIANT[status]} className="text-[10px] uppercase tracking-wide">
      {t(`substitution.status.${status}`)}
    </Badge>
  );
}

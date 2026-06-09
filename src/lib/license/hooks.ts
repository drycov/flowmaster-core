import { useQuery } from "@tanstack/react-query";
import { getLicenseStatus } from "@/lib/api/license.functions";
import { hasLicenseFeature, isLicenseWritable } from "./enforcement";
import type { LicenseFeature } from "./types";

export function useLicenseStatus() {
  const query = useQuery({
    queryKey: ["license-status"],
    queryFn: getLicenseStatus,
    staleTime: 60_000,
  });

  const status = query.data;
  const isWritable = isLicenseWritable(status);
  const can = (feature: LicenseFeature, requireWritable = true) =>
    hasLicenseFeature(status, feature, { requireWritable });

  return {
    ...query,
    status,
    isWritable,
    can,
    isGrace: status?.status === "grace",
    isExpired: status?.status === "expired",
    isSuspended: status?.status === "suspended",
    graceDaysRemaining: status?.grace_days_remaining ?? 0,
    daysRemaining: status?.days_remaining,
  };
}

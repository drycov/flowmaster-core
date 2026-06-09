import { redirect } from "@tanstack/react-router";
import { getLicenseStatus } from "@/lib/api/license.functions";
import type { LicenseFeature } from "./types";

/** Redirect to dashboard when licensed module is disabled. */
export async function requireLicenseModule(feature: LicenseFeature) {
  const status = await getLicenseStatus();
  if (!status.features[feature]) {
    throw redirect({ to: "/dashboard" });
  }
  return status;
}

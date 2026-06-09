import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LicenseFeature, LicenseStatusResponse } from "./types";

export type LicenseErrorCode = "expired" | "suspended" | "feature" | "seats" | "unavailable";

export class LicenseError extends Error {
  constructor(
    message: string,
    public readonly code: LicenseErrorCode,
  ) {
    super(message);
    this.name = "LicenseError";
  }
}

export function isLicenseError(err: unknown): err is LicenseError {
  return err instanceof LicenseError;
}

export async function fetchLicenseStatus(_supabase?: SupabaseClient): Promise<LicenseStatusResponse> {
  const { data, error } = await supabaseAdmin.rpc("get_license_status" as never);
  if (error) throw new Error(`License status failed: ${error.message}`);
  return data as LicenseStatusResponse;
}

export async function requireWritableLicense(
  supabase: SupabaseClient,
): Promise<LicenseStatusResponse> {
  const status = await fetchLicenseStatus(supabase);
  if (!status.is_writable) {
    const msg =
      status.status === "suspended"
        ? "Лицензия приостановлена. Операция недоступна."
        : "Срок действия лицензии истёк. Операция недоступна.";
    throw new LicenseError(msg, status.status === "suspended" ? "suspended" : "expired");
  }
  return status;
}

/** Feature access; optionally requires writable license (default true). */
export async function requireLicenseFeatureAccess(
  supabase: SupabaseClient,
  feature: LicenseFeature,
  requireWritable = true,
): Promise<LicenseStatusResponse> {
  const status = requireWritable
    ? await requireWritableLicense(supabase)
    : await fetchLicenseStatus(supabase);

  if (!status.features[feature]) {
    throw new LicenseError(`Модуль недоступен в текущем тарифном плане`, "feature");
  }
  return status;
}

export async function requireLicenseFeature(
  supabase: SupabaseClient,
  feature: LicenseFeature,
): Promise<void> {
  await requireLicenseFeatureAccess(supabase, feature, true);
}

export async function requireAvailableSeat(supabase: SupabaseClient): Promise<void> {
  const status = await requireWritableLicense(supabase);
  if (status.seats_available <= 0) {
    throw new LicenseError(
      `Достигнут лимит пользователей (${status.active_users}/${status.max_users})`,
      "seats",
    );
  }
}

export type EnforceLicenseOpts = {
  writable?: boolean;
  feature?: LicenseFeature;
  featureRead?: LicenseFeature;
  seats?: boolean;
};

export async function enforceLicense(
  supabase: SupabaseClient,
  opts: EnforceLicenseOpts,
): Promise<void> {
  if (opts.featureRead) {
    await requireLicenseFeatureAccess(supabase, opts.featureRead, false);
  }
  if (opts.writable) {
    await requireWritableLicense(supabase);
  }
  if (opts.feature) {
    await requireLicenseFeature(supabase, opts.feature);
  }
  if (opts.seats) {
    await requireAvailableSeat(supabase);
  }
}

export function isLicenseWritable(status: LicenseStatusResponse | undefined): boolean {
  if (!status) return false;
  return status.is_writable;
}

export function hasLicenseFeature(
  status: LicenseStatusResponse | undefined,
  feature: LicenseFeature,
  opts?: { requireWritable?: boolean },
): boolean {
  if (!status) return false;
  if (!status.features[feature]) return false;
  if (opts?.requireWritable !== false && !status.is_writable) return false;
  return true;
}

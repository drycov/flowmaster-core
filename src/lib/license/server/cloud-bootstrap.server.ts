import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getInstallationId } from "@/lib/env.server";
import { fetchLicenseStatus } from "../enforcement";
import {
  connectWithLicenseServer,
  shouldSyncLicense,
  syncLicenseWithServerSoft,
} from "./client.server";
import { shouldUseLicenseServer } from "./config.server";

/** Auto-connect EDMS to cloud license server by installation_id (no FM1 key). */
export async function ensureCloudLicense(): Promise<void> {
  if (!shouldUseLicenseServer()) return;

  const installationId = getInstallationId();
  if (!installationId) return;

  const { data: row } = await supabaseAdmin
    .from("installation_license")
    .select(
      "activation_mode, license_server_token, last_sync_at, sync_interval_hours, server_revoked",
    )
    .limit(1)
    .maybeSingle();

  const license = row as {
    activation_mode: string;
    license_server_token: string | null;
    last_sync_at: string | null;
    sync_interval_hours: number | null;
    server_revoked: boolean | null;
  } | null;

  if (!license?.license_server_token || license.activation_mode !== "online") {
    try {
      await connectWithLicenseServer(installationId);
    } catch {
      // Keep last known local entitlement when cloud is temporarily unreachable.
    }
    return;
  }

  if (license.server_revoked) {
    try {
      await connectWithLicenseServer(installationId);
    } catch {
      // Keep last known local entitlement when cloud is temporarily unreachable.
    }
    return;
  }

  if (shouldSyncLicense(license.last_sync_at, license.sync_interval_hours ?? 6)) {
    await syncLicenseWithServerSoft();
  }
}

export async function readLicenseStatusAfterBootstrap() {
  await ensureCloudLicense();
  return fetchLicenseStatus(supabaseAdmin);
}

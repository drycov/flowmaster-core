import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getInternalHookSecret } from "@/lib/internal-hook-auth.server";
import { isLicenseServerEnabled } from "@/lib/license/server/config.server";

export type HealthChecks = Record<string, string>;

export type HealthResult = {
  ok: boolean;
  checks: HealthChecks;
};

export async function runHealthChecks(): Promise<HealthResult> {
  const checks: HealthChecks = { app: "ok" };

  try {
    const { error } = await supabaseAdmin
      .from("organization" as never)
      .select("id")
      .limit(1)
      .maybeSingle();
    checks.database = error ? "error" : "ok";
    if (error) checks.database_error = error.message;
  } catch (e) {
    checks.database = "error";
    checks.database_error = e instanceof Error ? e.message : String(e);
  }

  try {
    if (isLicenseServerEnabled()) {
      const [{ count: keyCount }, { count: actCount }] = await Promise.all([
        supabaseAdmin
          .from("license_server_keys" as never)
          .select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("license_server_activations" as never)
          .select("id", { count: "exact", head: true })
          .eq("status", "active" as never),
      ]);
      checks.license_server = "ok";
      checks.license_server_keys = String(keyCount ?? 0);
      checks.license_server_activations = String(actCount ?? 0);
    } else {
      const { data, error } = await supabaseAdmin.rpc("get_license_status" as never);
      if (error) {
        checks.license = "error";
        checks.license_error = error.message;
      } else {
        const status = data as { status?: string } | null;
        checks.license = status?.status ?? "unknown";
      }
    }
  } catch (e) {
    const key = isLicenseServerEnabled() ? "license_server" : "license";
    checks[key] = "error";
    checks[`${key}_error`] = e instanceof Error ? e.message : String(e);
  }

  const cronSecret = getInternalHookSecret();
  if (process.env.NODE_ENV === "production") {
    checks.cron_secret = cronSecret ? "ok" : "missing";
  } else {
    checks.cron_secret = cronSecret ? "ok" : "optional";
  }

  const cronOk = process.env.NODE_ENV !== "production" || Boolean(cronSecret);

  return { ok: checks.database === "ok" && cronOk, checks };
}

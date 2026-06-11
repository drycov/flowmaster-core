import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    const { data, error } = await supabaseAdmin.rpc("get_license_status" as never);
    if (error) {
      checks.license = "error";
      checks.license_error = error.message;
    } else {
      const status = data as { status?: string } | null;
      checks.license = status?.status ?? "unknown";
    }
  } catch (e) {
    checks.license = "error";
    checks.license_error = e instanceof Error ? e.message : String(e);
  }

  return { ok: checks.database === "ok", checks };
}

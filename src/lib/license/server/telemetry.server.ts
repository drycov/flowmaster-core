import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppVersion } from "./config.server";
import type { LicenseUsageTelemetry } from "./types";

const MAX_COUNT = 99_999_999;

function clampInt(value: unknown, max = MAX_COUNT): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.floor(n));
}

function clampText(value: unknown, maxLen: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, maxLen);
}

export function sanitizeUsageTelemetry(input: unknown): LicenseUsageTelemetry | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  return {
    total_users: clampInt(raw.total_users, 999_999),
    active_users: clampInt(raw.active_users, 999_999),
    max_users_allowed: clampInt(raw.max_users_allowed, 999_999),
    documents_total: clampInt(raw.documents_total),
    documents_30d: clampInt(raw.documents_30d),
    workflows_published: clampInt(raw.workflows_published, 999_999),
    app_version: clampText(raw.app_version, 64),
    environment: clampText(raw.environment, 32),
    platform: clampText(raw.platform, 64),
  };
}

export async function persistUsageTelemetry(
  supabase: SupabaseClient,
  input: {
    installation_id: string;
    activation_id: string;
    telemetry: LicenseUsageTelemetry;
    active_users?: number;
    app_version?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const activeUsers = input.active_users ?? input.telemetry.active_users;

  await supabase.from("license_server_activations" as never).update({
    last_active_users: activeUsers,
    telemetry: input.telemetry,
    telemetry_at: now,
    app_version: input.app_version ?? input.telemetry.app_version,
  } as never).eq("id", input.activation_id);

  await supabase.from("license_server_telemetry_snapshots" as never).insert({
    installation_id: input.installation_id,
    activation_id: input.activation_id,
    reported_at: now,
    app_version: input.app_version ?? input.telemetry.app_version,
    total_users: input.telemetry.total_users,
    active_users: activeUsers,
    max_users_allowed: input.telemetry.max_users_allowed,
    documents_total: input.telemetry.documents_total,
    documents_30d: input.telemetry.documents_30d,
    workflows_published: input.telemetry.workflows_published,
    environment: input.telemetry.environment,
    platform: input.telemetry.platform,
    stats: {},
  } as never);
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Collect aggregate usage stats — no PII, document content, or identifiers. */
export async function collectLicenseUsageTelemetry(
  supabase: SupabaseClient,
): Promise<LicenseUsageTelemetry> {
  const since30d = daysAgoIso(30);

  const [
    profilesRes,
    activeUsersRes,
    docsTotalRes,
    docs30dRes,
    workflowsRes,
    licenseRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.rpc("license_active_user_count"),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since30d),
    supabase
      .from("workflows")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("installation_license").select("max_users").limit(1).maybeSingle(),
  ]);

  const totalUsers = profilesRes.count ?? 0;
  const activeUsers =
    typeof activeUsersRes.data === "number" ? activeUsersRes.data : totalUsers;
  const licenseRow = licenseRes.data as { max_users?: number } | null;

  return {
    total_users: totalUsers,
    active_users: activeUsers,
    max_users_allowed: licenseRow?.max_users ?? 0,
    documents_total: docsTotalRes.count ?? 0,
    documents_30d: docs30dRes.count ?? 0,
    workflows_published: workflowsRes.count ?? 0,
    app_version: getAppVersion(),
    environment: process.env.NODE_ENV?.trim() || "production",
    platform: `node/${process.versions.node}`,
  };
}

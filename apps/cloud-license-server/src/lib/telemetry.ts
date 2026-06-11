import type { SupabaseClient } from "@supabase/supabase-js";

/** Aggregated usage metrics — no document content, names, or IDs. */
export type LicenseUsageTelemetry = {
  total_users: number;
  active_users: number;
  max_users_allowed: number;
  documents_total: number;
  documents_30d: number;
  workflows_published: number;
  app_version: string;
  environment: string;
  platform: string;
};

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

  await supabase
    .from("license_server_activations")
    .update({
      last_active_users: activeUsers,
      telemetry: input.telemetry,
      telemetry_at: now,
      app_version: input.app_version ?? input.telemetry.app_version,
    })
    .eq("id", input.activation_id);

  await supabase.from("license_server_telemetry_snapshots").insert({
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
  });
}

export function telemetryFromRow(row: Record<string, unknown> | null | undefined): {
  reported_at: string | null;
  app_version: string;
  total_users: number;
  active_users: number;
  max_users_allowed: number;
  documents_total: number;
  documents_30d: number;
  workflows_published: number;
  environment: string;
  platform: string;
} | null {
  if (!row) return null;
  const telemetry = sanitizeUsageTelemetry(row.telemetry);
  if (!telemetry) {
    const activeUsers = clampInt(row.last_active_users, 999_999);
    if (!activeUsers && !row.app_version) return null;
    return {
      reported_at: row.telemetry_at ? String(row.telemetry_at) : null,
      app_version: clampText(row.app_version, 64),
      total_users: 0,
      active_users: activeUsers,
      max_users_allowed: 0,
      documents_total: 0,
      documents_30d: 0,
      workflows_published: 0,
      environment: "",
      platform: "",
    };
  }
  return {
    reported_at: row.telemetry_at ? String(row.telemetry_at) : null,
    ...telemetry,
    active_users: clampInt(row.last_active_users, 999_999) || telemetry.active_users,
    app_version: clampText(row.app_version, 64) || telemetry.app_version,
  };
}

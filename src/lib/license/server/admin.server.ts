import type { SupabaseClient } from "@supabase/supabase-js";
import type { LicenseFeature, LicensePlan } from "../types";
import { featureLabel, planLabel } from "../plans";

export type LicenseServerKeySummary = {
  id: string;
  key_hash: string;
  key_hash_short: string;
  plan: LicensePlan;
  plan_label_ru: string;
  max_users: number;
  customer_name: string;
  installation_id: string | null;
  expires_at: string | null;
  issued_at: string | null;
  status: string;
  max_activations: number;
  active_activations: number;
  revoked_reason: string;
  created_at: string;
  updated_at: string;
};

export type LicenseServerActivationSummary = {
  id: string;
  key_id: string;
  installation_id: string;
  status: string;
  hostname: string;
  app_version: string;
  last_seen_at: string;
  activated_at: string;
  revoked_at: string | null;
  revoked_reason: string;
  key_hash_short: string;
  plan: LicensePlan | null;
  customer_name: string;
};

export type LicenseServerProvisionSummary = {
  id: string;
  installation_id: string;
  plan: LicensePlan;
  plan_label_ru: string;
  max_users: number;
  customer_name: string;
  expires_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type LicenseServerAdminOverview = {
  keys_total: number;
  keys_active: number;
  keys_revoked: number;
  activations_total: number;
  activations_active: number;
  activations_revoked: number;
  checked_at: string;
};

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 16)}…` : hash;
}

export async function fetchLicenseServerOverview(
  supabase: SupabaseClient,
): Promise<LicenseServerAdminOverview> {
  const [keysRes, activationsRes] = await Promise.all([
    supabase.from("license_server_keys" as never).select("status", { count: "exact" }),
    supabase.from("license_server_activations" as never).select("status", { count: "exact" }),
  ]);

  if (keysRes.error) throw new Error(keysRes.error.message);
  if (activationsRes.error) throw new Error(activationsRes.error.message);

  const keys = (keysRes.data ?? []) as { status: string }[];
  const activations = (activationsRes.data ?? []) as { status: string }[];

  return {
    keys_total: keysRes.count ?? keys.length,
    keys_active: keys.filter((k) => k.status === "active").length,
    keys_revoked: keys.filter((k) => k.status === "revoked").length,
    activations_total: activationsRes.count ?? activations.length,
    activations_active: activations.filter((a) => a.status === "active").length,
    activations_revoked: activations.filter((a) => a.status === "revoked").length,
    checked_at: new Date().toISOString(),
  };
}

export async function listLicenseServerKeys(
  supabase: SupabaseClient,
  opts: { limit?: number; offset?: number; status?: "active" | "revoked" | "all" } = {},
): Promise<{ items: LicenseServerKeySummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  let q = supabase
    .from("license_server_keys" as never)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const keyIds = rows.map((r) => String(r.id));

  const activeCounts = new Map<string, number>();
  if (keyIds.length) {
    const { data: acts, error: actErr } = await supabase
      .from("license_server_activations" as never)
      .select("key_id, status")
      .in("key_id", keyIds);
    if (actErr) throw new Error(actErr.message);
    for (const act of (acts ?? []) as { key_id: string; status: string }[]) {
      if (act.status !== "active") continue;
      activeCounts.set(act.key_id, (activeCounts.get(act.key_id) ?? 0) + 1);
    }
  }

  const items: LicenseServerKeySummary[] = rows.map((row) => {
    const plan = String(row.plan) as LicensePlan;
    const keyHash = String(row.key_hash);
    return {
      id: String(row.id),
      key_hash: keyHash,
      key_hash_short: shortHash(keyHash),
      plan,
      plan_label_ru: planLabel(plan, "ru"),
      max_users: Number(row.max_users),
      customer_name: String(row.customer_name ?? ""),
      installation_id: row.installation_id ? String(row.installation_id) : null,
      expires_at: row.expires_at ? String(row.expires_at) : null,
      issued_at: row.issued_at ? String(row.issued_at) : null,
      status: String(row.status),
      max_activations: Number(row.max_activations ?? 1),
      active_activations: activeCounts.get(String(row.id)) ?? 0,
      revoked_reason: String(row.revoked_reason ?? ""),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  });

  return { items, total: count ?? items.length };
}

export async function listLicenseServerActivations(
  supabase: SupabaseClient,
  opts: { limit?: number; offset?: number; status?: "active" | "revoked" | "all" } = {},
): Promise<{ items: LicenseServerActivationSummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  let q = supabase
    .from("license_server_activations" as never)
    .select("*, license_server_keys(key_hash, plan, customer_name)", { count: "exact" })
    .order("last_seen_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const items: LicenseServerActivationSummary[] = ((data ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const key = row.license_server_keys as Record<string, unknown> | null;
      const keyHash = key?.key_hash ? String(key.key_hash) : "";
      return {
        id: String(row.id),
        key_id: String(row.key_id),
        installation_id: String(row.installation_id),
        status: String(row.status),
        hostname: String(row.hostname ?? ""),
        app_version: String(row.app_version ?? ""),
        last_seen_at: String(row.last_seen_at),
        activated_at: String(row.activated_at),
        revoked_at: row.revoked_at ? String(row.revoked_at) : null,
        revoked_reason: String(row.revoked_reason ?? ""),
        key_hash_short: keyHash ? shortHash(keyHash) : "—",
        plan: key?.plan ? (String(key.plan) as LicensePlan) : null,
        customer_name: key?.customer_name ? String(key.customer_name) : "",
      };
    },
  );

  return { items, total: count ?? items.length };
}

export async function listLicenseServerProvisions(
  supabase: SupabaseClient,
  opts: { limit?: number; offset?: number; status?: "active" | "revoked" | "all" } = {},
): Promise<{ items: LicenseServerProvisionSummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  let q = supabase
    .from("license_server_provisions" as never)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const items: LicenseServerProvisionSummary[] = ((data ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const plan = String(row.plan) as LicensePlan;
      return {
        id: String(row.id),
        installation_id: String(row.installation_id),
        plan,
        plan_label_ru: planLabel(plan, "ru"),
        max_users: Number(row.max_users),
        customer_name: String(row.customer_name ?? ""),
        expires_at: row.expires_at ? String(row.expires_at) : null,
        status: String(row.status),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      };
    },
  );

  return { items, total: count ?? items.length };
}

export function formatFeatureList(
  features: Partial<Record<LicenseFeature, boolean>>,
  locale: "ru" | "kk" = "ru",
): string[] {
  return (Object.entries(features) as [LicenseFeature, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([feature]) => featureLabel(feature, locale));
}

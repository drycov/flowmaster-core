import type { SupabaseClient } from "@supabase/supabase-js";
import { planLabel } from "./plans.js";
import type { LicensePlan } from "./types.js";

export type LicenseServerKeySummary = {
  id: string;
  key_hash_short: string;
  plan: LicensePlan;
  plan_label: string;
  max_users: number;
  customer_name: string;
  installation_id: string | null;
  expires_at: string | null;
  status: string;
  max_activations: number;
  active_activations: number;
};

export type LicenseServerActivationSummary = {
  id: string;
  installation_id: string;
  status: string;
  hostname: string;
  app_version: string;
  last_seen_at: string;
  customer_name: string;
  plan: LicensePlan | null;
};

export type LicenseServerProvisionSummary = {
  id: string;
  installation_id: string;
  plan: LicensePlan;
  plan_label: string;
  max_users: number;
  customer_name: string;
  expires_at: string | null;
  status: string;
};

export type LicenseServerAdminOverview = {
  keys_total: number;
  keys_active: number;
  keys_revoked: number;
  activations_total: number;
  activations_active: number;
  activations_revoked: number;
  provisions_total: number;
  provisions_active: number;
  checked_at: string;
};

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 16)}…` : hash;
}

export async function fetchLicenseServerOverview(
  supabase: SupabaseClient,
): Promise<LicenseServerAdminOverview> {
  const [keysRes, activationsRes, provisionsRes] = await Promise.all([
    supabase.from("license_server_keys").select("status", { count: "exact" }),
    supabase.from("license_server_activations").select("status", { count: "exact" }),
    supabase.from("license_server_provisions").select("status", { count: "exact" }),
  ]);

  if (keysRes.error) throw new Error(keysRes.error.message);
  if (activationsRes.error) throw new Error(activationsRes.error.message);
  if (provisionsRes.error) throw new Error(provisionsRes.error.message);

  const keys = (keysRes.data ?? []) as { status: string }[];
  const activations = (activationsRes.data ?? []) as { status: string }[];
  const provisions = (provisionsRes.data ?? []) as { status: string }[];

  return {
    keys_total: keysRes.count ?? keys.length,
    keys_active: keys.filter((k) => k.status === "active").length,
    keys_revoked: keys.filter((k) => k.status === "revoked").length,
    activations_total: activationsRes.count ?? activations.length,
    activations_active: activations.filter((a) => a.status === "active").length,
    activations_revoked: activations.filter((a) => a.status === "revoked").length,
    provisions_total: provisionsRes.count ?? provisions.length,
    provisions_active: provisions.filter((p) => p.status === "active").length,
    checked_at: new Date().toISOString(),
  };
}

export async function listLicenseServerKeys(
  supabase: SupabaseClient,
  opts: { limit?: number; status?: "active" | "revoked" | "all" } = {},
): Promise<{ items: LicenseServerKeySummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  let q = supabase
    .from("license_server_keys")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const keyIds = rows.map((r) => String(r.id));
  const activeCounts = new Map<string, number>();

  if (keyIds.length) {
    const { data: acts, error: actErr } = await supabase
      .from("license_server_activations")
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
    return {
      id: String(row.id),
      key_hash_short: shortHash(String(row.key_hash)),
      plan,
      plan_label: planLabel(plan),
      max_users: Number(row.max_users),
      customer_name: String(row.customer_name ?? ""),
      installation_id: row.installation_id ? String(row.installation_id) : null,
      expires_at: row.expires_at ? String(row.expires_at) : null,
      status: String(row.status),
      max_activations: Number(row.max_activations ?? 1),
      active_activations: activeCounts.get(String(row.id)) ?? 0,
    };
  });

  return { items, total: count ?? items.length };
}

export async function listLicenseServerActivations(
  supabase: SupabaseClient,
  opts: { limit?: number; status?: "active" | "revoked" | "all" } = {},
): Promise<{ items: LicenseServerActivationSummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  let q = supabase
    .from("license_server_activations")
    .select("*, license_server_keys(plan, customer_name)", { count: "exact" })
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const items: LicenseServerActivationSummary[] = ((data ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const key = row.license_server_keys as Record<string, unknown> | null;
      return {
        id: String(row.id),
        installation_id: String(row.installation_id),
        status: String(row.status),
        hostname: String(row.hostname ?? ""),
        app_version: String(row.app_version ?? ""),
        last_seen_at: String(row.last_seen_at),
        customer_name: key?.customer_name ? String(key.customer_name) : "",
        plan: key?.plan ? (String(key.plan) as LicensePlan) : null,
      };
    },
  );

  return { items, total: count ?? items.length };
}

export async function listLicenseServerProvisions(
  supabase: SupabaseClient,
  opts: { limit?: number; status?: "active" | "revoked" | "all" } = {},
): Promise<{ items: LicenseServerProvisionSummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  let q = supabase
    .from("license_server_provisions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const items: LicenseServerProvisionSummary[] = ((data ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const plan = String(row.plan) as LicensePlan;
      return {
        id: String(row.id),
        installation_id: String(row.installation_id),
        plan,
        plan_label: planLabel(plan),
        max_users: Number(row.max_users),
        customer_name: String(row.customer_name ?? ""),
        expires_at: row.expires_at ? String(row.expires_at) : null,
        status: String(row.status),
      };
    },
  );

  return { items, total: count ?? items.length };
}

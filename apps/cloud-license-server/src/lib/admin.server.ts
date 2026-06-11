import type { SupabaseClient } from "@supabase/supabase-js";
import { planLabel } from "./plans.js";
import { sanitizeUsageTelemetry } from "./telemetry.js";
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
  active_users: number;
  total_users: number;
  documents_total: number;
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
  last_seen_at: string | null;
  active_users: number;
  documents_total: number;
  days_until_expiry: number | null;
  account_email: string | null;
};

export type PortalClientSummary = {
  id: string;
  email: string;
  company_name: string;
  created_at: string;
  installations_count: number;
  installation_ids: string[];
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
  portal_clients_total: number;
  trials_expiring_7d: number;
  online_last_7d: number;
  checked_at: string;
};

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 16)}…` : hash;
}

export async function fetchLicenseServerOverview(
  supabase: SupabaseClient,
): Promise<LicenseServerAdminOverview> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
  const sevenDaysAhead = new Date(now + 7 * 86_400_000).toISOString();

  const [keysRes, activationsRes, provisionsRes, clientsRes, recentActsRes, expiringRes] =
    await Promise.all([
      supabase.from("license_server_keys").select("status", { count: "exact" }),
      supabase.from("license_server_activations").select("status", { count: "exact" }),
      supabase.from("license_server_provisions").select("status", { count: "exact" }),
      supabase.from("portal_accounts").select("id", { count: "exact", head: true }),
      supabase
        .from("license_server_activations")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gte("last_seen_at", sevenDaysAgo),
      supabase
        .from("license_server_provisions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .eq("plan", "trial")
        .not("expires_at", "is", null)
        .lte("expires_at", sevenDaysAhead),
    ]);

  if (keysRes.error) throw new Error(keysRes.error.message);
  if (activationsRes.error) throw new Error(activationsRes.error.message);
  if (provisionsRes.error) throw new Error(provisionsRes.error.message);
  if (clientsRes.error) throw new Error(clientsRes.error.message);
  if (recentActsRes.error) throw new Error(recentActsRes.error.message);
  if (expiringRes.error) throw new Error(expiringRes.error.message);

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
    portal_clients_total: clientsRes.count ?? 0,
    trials_expiring_7d: expiringRes.count ?? 0,
    online_last_7d: recentActsRes.count ?? 0,
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
      const telemetry = sanitizeUsageTelemetry(row.telemetry);
      return {
        id: String(row.id),
        installation_id: String(row.installation_id),
        status: String(row.status),
        hostname: String(row.hostname ?? ""),
        app_version: String(row.app_version ?? ""),
        last_seen_at: String(row.last_seen_at),
        customer_name: key?.customer_name ? String(key.customer_name) : "",
        plan: key?.plan ? (String(key.plan) as LicensePlan) : null,
        active_users: Number(row.last_active_users ?? telemetry?.active_users ?? 0),
        total_users: telemetry?.total_users ?? 0,
        documents_total: telemetry?.documents_total ?? 0,
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

  const rows = (data ?? []) as Record<string, unknown>[];
  const installationIds = rows.map((r) => String(r.installation_id));

  const actMap = new Map<string, Record<string, unknown>>();
  const emailByInstallation = new Map<string, string>();

  if (installationIds.length) {
    const [{ data: acts }, { data: links }] = await Promise.all([
      supabase
        .from("license_server_activations")
        .select("installation_id, last_seen_at, last_active_users, telemetry")
        .in("installation_id", installationIds)
        .eq("status", "active")
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("portal_account_installations")
        .select("installation_id, portal_accounts(email)")
        .in("installation_id", installationIds),
    ]);

    for (const act of (acts ?? []) as Record<string, unknown>[]) {
      const id = String(act.installation_id);
      if (!actMap.has(id)) actMap.set(id, act);
    }

    for (const link of (links ?? []) as Record<string, unknown>[]) {
      const id = String(link.installation_id);
      const account = link.portal_accounts as Record<string, unknown> | null;
      if (account?.email) emailByInstallation.set(id, String(account.email));
    }
  }

  const items: LicenseServerProvisionSummary[] = rows.map((row) => {
    const plan = String(row.plan) as LicensePlan;
    const installationId = String(row.installation_id);
    const act = actMap.get(installationId);
    const telemetry = sanitizeUsageTelemetry(act?.telemetry);
    const expiresAt = row.expires_at ? String(row.expires_at) : null;
    let days_until_expiry: number | null = null;
    if (expiresAt) {
      days_until_expiry = Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000),
      );
    }

    return {
      id: String(row.id),
      installation_id: installationId,
      plan,
      plan_label: planLabel(plan),
      max_users: Number(row.max_users),
      customer_name: String(row.customer_name ?? ""),
      expires_at: expiresAt,
      status: String(row.status),
      last_seen_at: act?.last_seen_at ? String(act.last_seen_at) : null,
      active_users: Number(act?.last_active_users ?? telemetry?.active_users ?? 0),
      documents_total: telemetry?.documents_total ?? 0,
      days_until_expiry,
      account_email: emailByInstallation.get(installationId) ?? null,
    };
  });

  return { items, total: count ?? items.length };
}

export async function listPortalClients(
  supabase: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<{ items: PortalClientSummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  const { data, error, count } = await supabase
    .from("portal_accounts")
    .select("id, email, company_name, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const accounts = (data ?? []) as Record<string, unknown>[];
  const accountIds = accounts.map((a) => String(a.id));

  const linksByAccount = new Map<string, string[]>();
  if (accountIds.length) {
    const { data: links, error: linkErr } = await supabase
      .from("portal_account_installations")
      .select("account_id, installation_id")
      .in("account_id", accountIds);
    if (linkErr) throw new Error(linkErr.message);
    for (const link of (links ?? []) as { account_id: string; installation_id: string }[]) {
      const list = linksByAccount.get(link.account_id) ?? [];
      list.push(link.installation_id);
      linksByAccount.set(link.account_id, list);
    }
  }

  const items: PortalClientSummary[] = accounts.map((row) => {
    const id = String(row.id);
    const installation_ids = linksByAccount.get(id) ?? [];
    return {
      id,
      email: String(row.email),
      company_name: String(row.company_name ?? ""),
      created_at: String(row.created_at),
      installations_count: installation_ids.length,
      installation_ids,
    };
  });

  return { items, total: count ?? items.length };
}

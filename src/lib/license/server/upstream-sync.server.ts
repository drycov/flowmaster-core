import type { SupabaseClient } from "@supabase/supabase-js";
import { getInstallationId } from "@/lib/env.server";
import { getAppVersion, getLicenseProduct, getLicenseUpstreamUrl, isLicenseServerEnabled } from "./config.server";
import type { LicenseActivateResponse, LicenseHeartbeatResponse } from "./types";

async function postUpstreamJson<T>(path: string, body: unknown): Promise<T> {
  const base = getLicenseUpstreamUrl();
  if (!base) throw new Error("LICENSE_UPSTREAM_URL не задан");

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof payload.error === "string"
        ? payload.error
        : `Upstream license error ${res.status}`;
    throw new Error(msg);
  }
  return payload as T;
}

export function upstreamReplicaEnabled(): boolean {
  return isLicenseServerEnabled() && !!getLicenseUpstreamUrl();
}

/** Pull entitlement from cloud master and cache locally (provisions + upstream token). */
export async function syncInstallationFromUpstream(
  supabase: SupabaseClient,
  installationId: string,
): Promise<void> {
  const upstream = getLicenseUpstreamUrl();
  if (!upstream) throw new Error("LICENSE_UPSTREAM_URL не задан");

  const hostname = process.env.PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";
  const result = await postUpstreamJson<LicenseActivateResponse>("/api/v1/license/connect", {
    installation_id: installationId,
    product: getLicenseProduct(),
    hostname,
    app_version: getAppVersion(),
  });

  const ent = result.entitlement;
  const { error: provErr } = await supabase.from("license_server_provisions" as never).upsert(
    {
      installation_id: installationId,
      plan: ent.plan,
      max_users: ent.max_users,
      features: ent.features,
      customer_name: ent.customer_name,
      expires_at: ent.expires_at,
      issued_at: ent.issued_at ?? new Date().toISOString(),
      status: "active",
      revoked_at: null,
      revoked_reason: "",
    } as never,
    { onConflict: "installation_id" },
  );
  if (provErr) throw new Error(provErr.message);

  const { error: cacheErr } = await supabase.from("license_server_upstream_cache" as never).upsert(
    {
      installation_id: installationId,
      upstream_token: result.token,
      upstream_key_id: result.key_id,
      last_sync_at: new Date().toISOString(),
      last_sync_ok: true,
      last_sync_error: "",
      server_revoked: false,
    } as never,
    { onConflict: "installation_id" },
  );
  if (cacheErr) throw new Error(cacheErr.message);
}

/** Phone-home to cloud master using cached upstream token (local replica cron). */
export async function relayUpstreamHeartbeat(
  supabase: SupabaseClient,
  installationId: string,
  activeUsers: number,
): Promise<LicenseHeartbeatResponse> {
  const { data: cache, error: loadErr } = await supabase
    .from("license_server_upstream_cache" as never)
    .select("upstream_token, server_revoked")
    .eq("installation_id", installationId)
    .maybeSingle();

  if (loadErr) throw new Error(loadErr.message);
  const row = cache as { upstream_token: string; server_revoked: boolean } | null;
  if (!row?.upstream_token) {
    await syncInstallationFromUpstream(supabase, installationId);
    return relayUpstreamHeartbeat(supabase, installationId, activeUsers);
  }

  const hostname = process.env.PUBLIC_APP_URL?.trim() || "";
  try {
    const result = await postUpstreamJson<LicenseHeartbeatResponse>("/api/v1/license/heartbeat", {
      token: row.upstream_token,
      installation_id: installationId,
      product: getLicenseProduct(),
      active_users: activeUsers,
      hostname,
      app_version: getAppVersion(),
    });

    const serverRevoked = result.status === "revoked" || result.status === "suspended";
    const patch: Record<string, unknown> = {
      last_sync_at: new Date().toISOString(),
      last_sync_ok: true,
      last_sync_error: result.message ?? "",
      server_revoked: serverRevoked,
      last_active_users: activeUsers,
    };

    if (serverRevoked) {
      await supabase
        .from("license_server_provisions" as never)
        .update({
          status: result.status === "revoked" ? "revoked" : "suspended",
          revoked_reason: result.message ?? "Отозвано на облаке",
          revoked_at: new Date().toISOString(),
        } as never)
        .eq("installation_id", installationId);
    } else if (result.entitlement) {
      const ent = result.entitlement;
      await supabase
        .from("license_server_provisions" as never)
        .update({
          plan: ent.plan,
          max_users: ent.max_users,
          features: ent.features,
          customer_name: ent.customer_name,
          expires_at: ent.expires_at,
          issued_at: ent.issued_at,
          status: "active",
        } as never)
        .eq("installation_id", installationId);
    }

    await supabase
      .from("license_server_upstream_cache" as never)
      .update(patch as never)
      .eq("installation_id", installationId);

    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("license_server_upstream_cache" as never)
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_ok: false,
        last_sync_error: message,
      } as never)
      .eq("installation_id", installationId);
    throw e;
  }
}

export async function runUpstreamReplicaSync(
  supabase: SupabaseClient,
): Promise<{ installation_id: string; ok: boolean; error?: string }> {
  const installationId = getInstallationId();
  if (!installationId) {
    return { installation_id: "", ok: false, error: "INSTALLATION_ID не задан" };
  }

  const { data: activations } = await supabase
    .from("license_server_activations" as never)
    .select("last_active_users")
    .eq("installation_id", installationId)
    .eq("status", "active");

  const rows = (activations ?? []) as { last_active_users: number }[];
  const activeUsers = rows.reduce((max, r) => Math.max(max, r.last_active_users ?? 0), 0);

  try {
    await relayUpstreamHeartbeat(supabase, installationId, activeUsers);
    return { installation_id: installationId, ok: true };
  } catch (e) {
    return {
      installation_id: installationId,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

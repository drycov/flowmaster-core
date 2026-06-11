import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getInstallationId } from "@/lib/env.server";
import { fetchLicenseStatus } from "../enforcement";
import type { LicenseStatusResponse } from "../types";
import {
  getAppVersion,
  getLicenseServerUrl,
  isOnlineLicenseRequired,
  shouldUseLicenseServer,
} from "./config.server";
import type {
  LicenseActivateResponse,
  LicenseHeartbeatResponse,
  LicenseServerEntitlement,
} from "./types";

function serverUrl(): string {
  const url = getLicenseServerUrl();
  if (!url) {
    throw new Error("LICENSE_SERVER_URL не задан");
  }
  return url;
}

export function installationBindingHash(installationId: string): string {
  return createHash("sha256").update(`installation:${installationId}`).digest("hex");
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${serverUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`License server: некорректный ответ (${res.status})`);
  }
  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: string }).error)
        : `License server error ${res.status}`;
    throw new Error(msg);
  }
  return payload as T;
}

export function shouldSyncLicense(
  lastSyncAt: string | null | undefined,
  intervalHours: number,
): boolean {
  if (!lastSyncAt) return true;
  const hours = (Date.now() - new Date(lastSyncAt).getTime()) / 3_600_000;
  return hours >= Math.max(1, intervalHours);
}

async function applyEntitlementLocally(
  entitlement: LicenseServerEntitlement,
  opts: {
    installationId: string;
    licenseKeyHash: string;
    token: string;
    keyId: string;
    activatedBy?: string;
    syncOk: boolean;
    syncError?: string;
    serverRevoked?: boolean;
  },
): Promise<LicenseStatusResponse> {
  const patch = {
    plan: entitlement.plan,
    status: opts.serverRevoked ? "suspended" : "active",
    license_key_hash: opts.licenseKeyHash,
    installation_id: opts.installationId,
    max_users: entitlement.max_users,
    features: entitlement.features,
    customer_name: entitlement.customer_name,
    issued_at: entitlement.issued_at,
    expires_at: entitlement.expires_at,
    activated_at: new Date().toISOString(),
    activated_by: opts.activatedBy ?? null,
    activation_mode: "online" as const,
    license_server_token: opts.token,
    license_key_id: opts.keyId,
    last_sync_at: new Date().toISOString(),
    last_sync_ok: opts.syncOk,
    last_sync_error: opts.syncError ?? "",
    server_revoked: !!opts.serverRevoked,
  };

  const { data: existing } = await supabaseAdmin
    .from("installation_license")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("installation_license")
      .update(patch as never)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from("installation_license").insert(patch as never);
    if (error) throw new Error(error.message);
  }

  return fetchLicenseStatus(supabaseAdmin);
}

function applyActivationResult(
  result: LicenseActivateResponse,
  installationId: string,
  licenseKeyHash: string,
  activatedBy?: string,
): Promise<LicenseStatusResponse> {
  return applyEntitlementLocally(result.entitlement, {
    installationId,
    licenseKeyHash,
    token: result.token,
    keyId: result.key_id,
    activatedBy,
    syncOk: true,
  });
}

export async function connectWithLicenseServer(
  installationId: string,
  activatedBy?: string,
): Promise<LicenseStatusResponse> {
  const hostname = process.env.PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";
  const result = await postJson<LicenseActivateResponse>("/api/v1/license/connect", {
    installation_id: installationId,
    hostname,
    app_version: getAppVersion(),
  });

  return applyActivationResult(
    result,
    installationId,
    installationBindingHash(installationId),
    activatedBy,
  );
}

export async function activateWithLicenseServer(
  licenseKey: string,
  installationId: string,
  activatedBy?: string,
): Promise<LicenseStatusResponse> {
  const { hashLicenseKey } = await import("../keys.server");
  const hostname = process.env.PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";
  const result = await postJson<LicenseActivateResponse>("/api/v1/license/activate", {
    license_key: licenseKey.trim(),
    installation_id: installationId,
    hostname,
    app_version: getAppVersion(),
  });

  return applyActivationResult(result, installationId, hashLicenseKey(licenseKey), activatedBy);
}

async function runHeartbeatSync(
  supabase: SupabaseClient,
  license: {
    id: string;
    license_server_token: string;
    installation_id: string;
  },
): Promise<LicenseStatusResponse> {
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });

  const result = await postJson<LicenseHeartbeatResponse>("/api/v1/license/heartbeat", {
    token: license.license_server_token,
    installation_id: license.installation_id,
    active_users: count ?? 0,
    hostname: process.env.PUBLIC_APP_URL?.trim() || "",
    app_version: getAppVersion(),
  });

  const serverRevoked = result.status === "revoked" || result.status === "suspended";
  const patch: Record<string, unknown> = {
    last_sync_at: new Date().toISOString(),
    last_sync_ok: true,
    last_sync_error: "",
    server_revoked: serverRevoked,
    status: serverRevoked ? "suspended" : "active",
  };

  if (result.entitlement) {
    patch.plan = result.entitlement.plan;
    patch.max_users = result.entitlement.max_users;
    patch.features = result.entitlement.features;
    patch.expires_at = result.entitlement.expires_at;
    patch.customer_name = result.entitlement.customer_name;
    patch.issued_at = result.entitlement.issued_at;
  }

  if (result.message && serverRevoked) {
    patch.last_sync_error = result.message;
  }

  const { error: updErr } = await supabase
    .from("installation_license")
    .update(patch as never)
    .eq("id", license.id);
  if (updErr) throw new Error(updErr.message);

  return fetchLicenseStatus(supabase);
}

export async function syncLicenseWithServerSoft(
  supabase: SupabaseClient = supabaseAdmin,
): Promise<LicenseStatusResponse> {
  try {
    return await syncLicenseWithServer(supabase);
  } catch {
    return fetchLicenseStatus(supabase);
  }
}

export async function syncLicenseWithServer(
  supabase: SupabaseClient = supabaseAdmin,
): Promise<LicenseStatusResponse> {
  const { data: row, error: loadErr } = await supabase
    .from("installation_license")
    .select(
      "id, activation_mode, license_server_token, installation_id, license_key_hash, server_revoked",
    )
    .limit(1)
    .maybeSingle();

  if (loadErr) throw new Error(loadErr.message);
  const license = row as {
    id: string;
    activation_mode: string;
    license_server_token: string | null;
    installation_id: string | null;
  } | null;

  if (!license || license.activation_mode !== "online" || !license.license_server_token) {
    if (shouldUseLicenseServer()) {
      const installationId = getInstallationId();
      if (installationId) {
        return connectWithLicenseServer(installationId);
      }
      throw new Error("INSTALLATION_ID не задан");
    }
    if (isOnlineLicenseRequired()) {
      throw new Error("Онлайн-лицензия не активирована");
    }
    return fetchLicenseStatus(supabase);
  }

  const installationId = license.installation_id ?? getInstallationId();
  if (!installationId) throw new Error("INSTALLATION_ID не задан");

  try {
    return await runHeartbeatSync(supabase, {
      id: license.id,
      license_server_token: license.license_server_token,
      installation_id: installationId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("installation_license")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_ok: false,
        last_sync_error: message,
      } as never)
      .eq("id", license.id);
    return fetchLicenseStatus(supabase);
  }
}

export function licenseServerAvailable(): boolean {
  return shouldUseLicenseServer();
}

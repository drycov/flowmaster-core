import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashLicenseKey, parseLicenseKey } from "../keys.server";
import { persistUsageTelemetry, sanitizeUsageTelemetry } from "./telemetry.server";
import type {
  LicenseActivateRequest,
  LicenseActivateResponse,
  LicenseConnectRequest,
  LicenseHeartbeatRequest,
  LicenseHeartbeatResponse,
  LicenseRevokeRequest,
  LicenseServerEntitlement,
} from "./types";

const DEFAULT_HEARTBEAT_HOURS = 6;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function issueToken(): string {
  return `FMT.${randomBytes(32).toString("base64url")}`;
}

function rowToEntitlement(row: {
  plan: string;
  max_users: number;
  features: unknown;
  expires_at: string | null;
  customer_name: string;
  issued_at: string | null;
}): LicenseServerEntitlement {
  return {
    plan: row.plan as LicenseServerEntitlement["plan"],
    max_users: row.max_users,
    features: (row.features ?? {}) as LicenseServerEntitlement["features"],
    expires_at: row.expires_at,
    customer_name: row.customer_name,
    issued_at: row.issued_at,
  };
}

async function ensureKeyRegistered(
  supabase: SupabaseClient,
  licenseKey: string,
): Promise<{ id: string; row: Record<string, unknown> }> {
  const payload = parseLicenseKey(licenseKey);
  const keyHash = hashLicenseKey(licenseKey);

  const { data: existing, error: loadErr } = await supabase
    .from("license_server_keys" as never)
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (loadErr) throw new Error(loadErr.message);
  if (existing) {
    const row = existing as Record<string, unknown>;
    if (row.status === "revoked") {
      throw new Error("Лицензионный ключ отозван поставщиком");
    }
    return { id: String(row.id), row };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("license_server_keys" as never)
    .insert({
      key_hash: keyHash,
      plan: payload.plan,
      max_users: payload.max_users,
      features: payload.features,
      customer_name: payload.customer,
      installation_id: payload.installation_id ?? null,
      expires_at: payload.expires_at,
      issued_at: payload.issued_at,
      status: "active",
    } as never)
    .select("*")
    .single();

  if (insErr) throw new Error(insErr.message);
  return { id: String((inserted as { id: string }).id), row: inserted as Record<string, unknown> };
}

function provisionKeyHash(installationId: string): string {
  return sha256Hex(`provision:v1:${installationId}`);
}

async function upsertProvisionKey(
  supabase: SupabaseClient,
  provision: Record<string, unknown>,
  installationId: string,
): Promise<{ id: string; row: Record<string, unknown> }> {
  const keyHash = provisionKeyHash(installationId);
  const patch = {
    key_hash: keyHash,
    plan: provision.plan,
    max_users: provision.max_users,
    features: provision.features,
    customer_name: provision.customer_name,
    installation_id: installationId,
    expires_at: provision.expires_at,
    issued_at: provision.issued_at,
    status: "active",
  };

  const { data: existing, error: loadErr } = await supabase
    .from("license_server_keys" as never)
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from("license_server_keys" as never)
      .update(patch as never)
      .eq("id", (existing as { id: string }).id)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);
    return { id: String((updated as { id: string }).id), row: updated as Record<string, unknown> };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("license_server_keys" as never)
    .insert(patch as never)
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);
  return { id: String((inserted as { id: string }).id), row: inserted as Record<string, unknown> };
}

async function activateKeyForInstallation(
  supabase: SupabaseClient,
  keyId: string,
  keyRow: Record<string, unknown>,
  req: { installation_id: string; hostname?: string; app_version?: string },
): Promise<LicenseActivateResponse> {
  if (keyRow.expires_at) {
    const exp = new Date(String(keyRow.expires_at)).getTime();
    if (!Number.isNaN(exp) && exp < Date.now()) {
      throw new Error("Срок действия лицензии истёк");
    }
  }

  const token = issueToken();
  const tokenHash = sha256Hex(token);

  const { data: prior, error: priorErr } = await supabase
    .from("license_server_activations" as never)
    .select("id, status")
    .eq("key_id", keyId)
    .eq("installation_id", req.installation_id)
    .maybeSingle();

  if (priorErr) throw new Error(priorErr.message);

  if (prior) {
    const p = prior as { id: string; status: string };
    if (p.status === "revoked") {
      throw new Error("Активация отозвана поставщиком");
    }
    const { error: updErr } = await supabase
      .from("license_server_activations" as never)
      .update({
        token_hash: tokenHash,
        status: "active",
        hostname: req.hostname ?? "",
        app_version: req.app_version ?? "",
        last_seen_at: new Date().toISOString(),
      } as never)
      .eq("id", p.id);
    if (updErr) throw new Error(updErr.message);
  } else {
    const { count, error: countErr } = await supabase
      .from("license_server_activations" as never)
      .select("id", { count: "exact", head: true })
      .eq("key_id", keyId)
      .eq("status", "active");

    if (countErr) throw new Error(countErr.message);
    const maxActivations = Number(keyRow.max_activations ?? 1);
    if ((count ?? 0) >= maxActivations) {
      throw new Error("Достигнут лимит активаций для этого ключа");
    }

    const { error: insErr } = await supabase.from("license_server_activations" as never).insert({
      key_id: keyId,
      installation_id: req.installation_id,
      token_hash: tokenHash,
      hostname: req.hostname ?? "",
      app_version: req.app_version ?? "",
    } as never);
    if (insErr) throw new Error(insErr.message);
  }

  return {
    token,
    key_id: keyId,
    entitlement: rowToEntitlement(keyRow as Parameters<typeof rowToEntitlement>[0]),
    next_heartbeat_hours: DEFAULT_HEARTBEAT_HOURS,
  };
}

export async function upsertProvisionOnServer(
  supabase: SupabaseClient,
  input: {
    installation_id: string;
    plan: string;
    max_users: number;
    features: Record<string, boolean>;
    customer_name: string;
    expires_at: string | null;
  },
): Promise<{ id: string; installation_id: string }> {
  const { data, error } = await supabase
    .from("license_server_provisions" as never)
    .upsert(
      {
        installation_id: input.installation_id,
        plan: input.plan,
        max_users: input.max_users,
        features: input.features,
        customer_name: input.customer_name,
        expires_at: input.expires_at,
        status: "active",
        revoked_at: null,
        revoked_reason: "",
      } as never,
      { onConflict: "installation_id" },
    )
    .select("id, installation_id")
    .single();
  if (error) throw new Error(error.message);
  const row = data as { id: string; installation_id: string };
  return row;
}

export async function connectOnLicenseServer(
  supabase: SupabaseClient,
  req: LicenseConnectRequest,
): Promise<LicenseActivateResponse> {
  let { data: provision, error } = await supabase
    .from("license_server_provisions" as never)
    .select("*")
    .eq("installation_id", req.installation_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!provision) {
    const { getLicenseUpstreamUrl } = await import("./config.server");
    const { syncInstallationFromUpstream } = await import("./upstream-sync.server");
    if (getLicenseUpstreamUrl()) {
      await syncInstallationFromUpstream(supabase, req.installation_id);
      ({ data: provision, error } = await supabase
        .from("license_server_provisions" as never)
        .select("*")
        .eq("installation_id", req.installation_id)
        .maybeSingle());
      if (error) throw new Error(error.message);
    }
  }
  if (!provision) {
    throw new Error("Установка не зарегистрирована на license server");
  }

  const row = provision as Record<string, unknown>;
  if (row.status === "revoked" || row.status === "suspended") {
    throw new Error(String(row.revoked_reason || "Лицензия приостановлена поставщиком"));
  }

  if (row.expires_at) {
    const exp = new Date(String(row.expires_at)).getTime();
    if (!Number.isNaN(exp) && exp < Date.now()) {
      throw new Error("Срок действия лицензии истёк");
    }
  }

  const { id: keyId, row: keyRow } = await upsertProvisionKey(
    supabase,
    row,
    req.installation_id,
  );
  return activateKeyForInstallation(supabase, keyId, keyRow, req);
}

export async function registerLicenseKeyOnServer(
  supabase: SupabaseClient,
  licenseKey: string,
): Promise<{ key_id: string; key_hash: string }> {
  const { id } = await ensureKeyRegistered(supabase, licenseKey);
  return { key_id: id, key_hash: hashLicenseKey(licenseKey) };
}

export async function activateOnLicenseServer(
  supabase: SupabaseClient,
  req: LicenseActivateRequest,
): Promise<LicenseActivateResponse> {
  const { id: keyId, row: keyRow } = await ensureKeyRegistered(supabase, req.license_key);

  if (keyRow.installation_id && req.installation_id) {
    if (String(keyRow.installation_id) !== req.installation_id) {
      throw new Error("Ключ привязан к другой установке");
    }
  }

  return activateKeyForInstallation(supabase, keyId, keyRow, req);
}

export async function heartbeatOnLicenseServer(
  supabase: SupabaseClient,
  req: LicenseHeartbeatRequest,
): Promise<LicenseHeartbeatResponse> {
  const tokenHash = sha256Hex(req.token);

  const { data: activation, error } = await supabase
    .from("license_server_activations" as never)
    .select("*, license_server_keys(*)")
    .eq("token_hash", tokenHash)
    .eq("installation_id", req.installation_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!activation) {
    return {
      status: "revoked",
      next_heartbeat_hours: DEFAULT_HEARTBEAT_HOURS,
      message: "Активация не найдена",
    };
  }

  const act = activation as Record<string, unknown>;
  const key = act.license_server_keys as Record<string, unknown> | null;

  if (act.status === "revoked" || key?.status === "revoked") {
    return {
      status: "revoked",
      next_heartbeat_hours: DEFAULT_HEARTBEAT_HOURS,
      message: String(act.revoked_reason || key?.revoked_reason || "Отозвано поставщиком"),
    };
  }

  if (key?.expires_at) {
    const exp = new Date(String(key.expires_at)).getTime();
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return {
        status: "suspended",
        next_heartbeat_hours: DEFAULT_HEARTBEAT_HOURS,
        message: "Срок действия лицензии истёк",
      };
    }
  }

  await supabase
    .from("license_server_activations" as never)
    .update({
      last_seen_at: new Date().toISOString(),
      hostname: req.hostname ?? act.hostname,
      app_version: req.app_version ?? act.app_version,
      last_active_users: req.active_users ?? req.telemetry?.active_users ?? 0,
    } as never)
    .eq("id", act.id);

  const telemetry = sanitizeUsageTelemetry(req.telemetry);
  if (telemetry) {
    await persistUsageTelemetry(supabase, {
      installation_id: req.installation_id,
      activation_id: String(act.id),
      telemetry,
      active_users: req.active_users ?? telemetry.active_users,
      app_version: req.app_version ?? telemetry.app_version,
    });
  }

  return {
    status: "active",
    entitlement: key ? rowToEntitlement(key as Parameters<typeof rowToEntitlement>[0]) : undefined,
    next_heartbeat_hours: DEFAULT_HEARTBEAT_HOURS,
  };
}

export async function revokeOnLicenseServer(
  supabase: SupabaseClient,
  req: LicenseRevokeRequest,
): Promise<{ revoked_keys: number; revoked_activations: number }> {
  if (!req.key_id && !req.installation_id && !req.key_hash) {
    throw new Error("Укажите key_id, installation_id или key_hash");
  }

  let revokedKeys = 0;
  let revokedActivations = 0;
  const now = new Date().toISOString();
  const reason = req.reason?.trim() || "Revoked by vendor";

  if (req.key_id || req.key_hash) {
    let q = supabase.from("license_server_keys" as never).update({
      status: "revoked",
      revoked_at: now,
      revoked_reason: reason,
    } as never);
    if (req.key_id) q = q.eq("id", req.key_id);
    else q = q.eq("key_hash", req.key_hash!);
    const { data, error } = await q.select("id");
    if (error) throw new Error(error.message);
    revokedKeys = data?.length ?? 0;

    const keyIds = (data ?? []).map((r) => (r as { id: string }).id);
    if (keyIds.length) {
      const { data: acts, error: actErr } = await supabase
        .from("license_server_activations" as never)
        .update({ status: "revoked", revoked_at: now, revoked_reason: reason } as never)
        .in("key_id", keyIds)
        .select("id");
      if (actErr) throw new Error(actErr.message);
      revokedActivations = acts?.length ?? 0;
    }
  }

  if (req.installation_id) {
    await supabase
      .from("license_server_provisions" as never)
      .update({
        status: "revoked",
        revoked_at: now,
        revoked_reason: reason,
      } as never)
      .eq("installation_id", req.installation_id);

    const { data: acts, error: actErr } = await supabase
      .from("license_server_activations" as never)
      .update({ status: "revoked", revoked_at: now, revoked_reason: reason } as never)
      .eq("installation_id", req.installation_id)
      .select("id");
    if (actErr) throw new Error(actErr.message);
    revokedActivations += acts?.length ?? 0;
  }

  return { revoked_keys: revokedKeys, revoked_activations: revokedActivations };
}

export function verifyLicenseServerAdmin(request: Request): boolean {
  const secret = process.env.LICENSE_SERVER_ADMIN_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return safeEqual(auth.slice(7), secret);
}

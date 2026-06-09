import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getLicenseSigningSecret } from "@/lib/installation.server";
import { PLAN_PRESETS } from "./plans";
import {
  LICENSE_FEATURES,
  LICENSE_PLANS,
  type LicenseFeature,
  type LicenseKeyPayload,
  type LicensePlan,
} from "./types";

const KEY_PREFIX = "FM1";

function signingSecret(): string {
  return getLicenseSigningSecret();
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function signPayload(encodedPayload: string): string {
  const sig = createHmac("sha256", signingSecret()).update(encodedPayload).digest();
  return toBase64Url(sig);
}

function normalizeFeatures(raw: unknown): LicenseKeyPayload["features"] {
  const result: LicenseKeyPayload["features"] = {};
  if (!raw || typeof raw !== "object") return result;
  for (const key of LICENSE_FEATURES) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === true) result[key] = true;
  }
  return result;
}

export function parseLicenseKey(key: string): LicenseKeyPayload {
  const trimmed = key.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== KEY_PREFIX) {
    throw new Error("Неверный формат лицензионного ключа");
  }

  const [, encodedPayload, encodedSig] = parts;
  const expectedSig = signPayload(encodedPayload);
  const a = fromBase64Url(encodedSig);
  const b = fromBase64Url(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Недействительная подпись лицензионного ключа");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));
  } catch {
    throw new Error("Некорректное содержимое лицензионного ключа");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Некорректное содержимое лицензионного ключа");
  }

  const p = parsed as Partial<LicenseKeyPayload>;
  if (p.v !== 1) throw new Error("Неподдерживаемая версия ключа");

  const plan = p.plan as LicensePlan;
  if (!LICENSE_PLANS.includes(plan)) {
    throw new Error("Неизвестный тарифный план в ключе");
  }

  const maxUsers = Number(p.max_users);
  if (!Number.isFinite(maxUsers) || maxUsers < 1) {
    throw new Error("Некорректный лимит пользователей в ключе");
  }

  const preset = PLAN_PRESETS[plan];
  const features = { ...preset.features, ...normalizeFeatures(p.features) };

  return {
    v: 1,
    plan,
    max_users: Math.floor(maxUsers),
    features,
    expires_at: p.expires_at ?? null,
    customer: typeof p.customer === "string" ? p.customer.trim() : "",
    installation_id: p.installation_id ?? null,
    issued_at: typeof p.issued_at === "string" ? p.issued_at : new Date().toISOString(),
  };
}

export function generateLicenseKey(input: {
  plan: LicensePlan;
  max_users?: number;
  features?: Partial<Record<LicenseFeature, boolean>>;
  expires_at?: string | null;
  customer?: string;
  installation_id?: string | null;
}): string {
  const preset = PLAN_PRESETS[input.plan];
  const payload: LicenseKeyPayload = {
    v: 1,
    plan: input.plan,
    max_users: input.max_users ?? preset.max_users,
    features: { ...preset.features, ...input.features },
    expires_at:
      input.expires_at !== undefined
        ? input.expires_at
        : input.plan === "trial" && preset.trial_days
          ? new Date(Date.now() + preset.trial_days * 86400000).toISOString()
          : input.plan === "enterprise"
            ? null
            : new Date(Date.now() + 365 * 86400000).toISOString(),
    customer: input.customer ?? "",
    installation_id: input.installation_id ?? null,
    issued_at: new Date().toISOString(),
  };

  const encodedPayload = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const encodedSig = signPayload(encodedPayload);
  return `${KEY_PREFIX}.${encodedPayload}.${encodedSig}`;
}

export function hashLicenseKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

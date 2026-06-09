import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fixUtf8Mojibake } from "@/lib/iin-parser";

export type CertInfo = {
  subject?: string;
  issuer?: string;
  serial?: string;
  iin?: string;
  bin?: string;
  cn?: string;
};

export function edsEmail(iin: string) {
  return `eds.${iin}@esedo.local`;
}

export function isEdsPlaceholderEmail(email: string) {
  return /^eds\.\d{12}@esedo\.local$/i.test(email.trim());
}

export function parseIinFromSubject(subject?: string): string | null {
  if (!subject) return null;
  const m =
    subject.match(/SERIALNUMBER\s*=\s*IIN(\d{12})/i) ||
    subject.match(/1\.2\.860\.3\.16\.1\.1\s*=\s*(\d{12})/) ||
    subject.match(/(\d{12})/);
  return m?.[1] ?? null;
}

export function extractIin(cert: CertInfo): string | null {
  if (cert.iin && /^\d{12}$/.test(cert.iin)) return cert.iin;
  return parseIinFromSubject(cert.subject);
}

export function displayNameFromCert(cert: CertInfo, fallback?: string): string {
  return fixUtf8Mojibake(
    fallback ||
      cert.cn ||
      cert.subject?.match(/CN\s*=\s*([^,]+)/i)?.[1]?.trim() ||
      "Пользователь",
  );
}

function normalizePersonName(value: string): string {
  return fixUtf8Mojibake(value).toUpperCase().replace(/\s+/g, " ").trim();
}

/** CN из сертификата должен совпадать с ФИО в профиле (при привязке из личного кабинета). */
export function verifyCnMatchesProfile(
  cert: CertInfo,
  profile: { full_name_ru?: string | null; full_name_kk?: string | null },
): boolean {
  const cn = displayNameFromCert(cert);
  if (!cn || cn === "Пользователь") return true;

  const ncn = normalizePersonName(cn);
  const names = [profile.full_name_ru, profile.full_name_kk].filter(Boolean) as string[];
  if (!names.length) return true;

  return names.some((name) => {
    const normalized = normalizePersonName(name);
    return normalized === ncn || normalized.includes(ncn) || ncn.includes(normalized);
  });
}

export function resolveAuthMethod(hasPassword: boolean, hasIin: boolean): "email" | "eds" | "both" {
  if (hasPassword && hasIin) return "both";
  if (hasIin) return "eds";
  return "email";
}

export async function consumeAuthChallenge(challengeId: string, expectedPurpose?: string) {
  const { data: challenge, error } = await supabaseAdmin
    .from("auth_challenges" as never)
    .select("id, nonce, purpose, expires_at, used_at")
    .eq("id", challengeId)
    .single();

  if (error || !challenge) throw new Error("Сессия подписи не найдена");

  const ch = challenge as {
    id: string;
    purpose: string;
    expires_at: string;
    used_at: string | null;
  };

  if (expectedPurpose && ch.purpose !== expectedPurpose) {
    throw new Error("Неверный тип запроса подписи");
  }
  if (ch.used_at) throw new Error("Подпись уже использована");
  if (new Date(ch.expires_at) < new Date()) throw new Error("Время подписи истекло");

  await supabaseAdmin
    .from("auth_challenges" as never)
    .update({ used_at: new Date().toISOString() } as never)
    .eq("id", ch.id);

  return ch;
}

export async function findProfileByIin(iin: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, iin, password_hash, auth_method, full_name_ru, full_name_kk")
    .eq("iin", iin)
    .maybeSingle();
  return data as {
    id: string;
    email: string;
    iin: string | null;
    password_hash: string | null;
    auth_method: string;
    full_name_ru: string | null;
    full_name_kk: string | null;
  } | null;
}

async function releaseIinFromProfile(userId: string) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      iin: null,
      cert_subject: null,
      cert_serial: null,
      auth_method: "email",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

/** Переносит ИИН с временного EDS-аккаунта (eds.{iin}@esedo.local) на основной email-аккаунт. */
async function mergeEdsPlaceholderInto(
  placeholderUserId: string,
  targetUserId: string,
  iin: string,
  cert: CertInfo,
  displayName?: string,
) {
  await releaseIinFromProfile(placeholderUserId);

  const { data: placeholderRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", placeholderUserId);

  if (placeholderRoles?.length) {
    for (const row of placeholderRoles) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: targetUserId, role: row.role } as never, {
          onConflict: "user_id,role",
        });
    }
  }

  await applyEdsFields(targetUserId, iin, cert, displayName);
}

async function applyEdsFields(
  userId: string,
  iin: string,
  cert: CertInfo,
  displayName?: string,
) {
  const { data: profile, error: loadErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email, password_hash, full_name_ru, full_name_kk")
    .eq("id", userId)
    .single();

  if (loadErr || !profile) throw new Error("Профиль не найден");

  const p = profile as {
    email: string;
    password_hash: string | null;
    full_name_ru: string | null;
    full_name_kk: string | null;
  };

  const name = displayNameFromCert(cert, displayName || p.full_name_ru || undefined);

  // EDS-placeholder accounts keep internal random password — not user-facing email login.
  const authMethod = isEdsPlaceholderEmail(p.email)
    ? "eds"
    : resolveAuthMethod(!!p.password_hash, true);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      iin,
      cert_subject: cert.subject ?? null,
      cert_serial: cert.serial ?? null,
      auth_method: authMethod,
      full_name_ru: p.full_name_ru || name,
      full_name_kk: p.full_name_kk || name,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function assertIinAvailable(iin: string, exceptUserId?: string) {
  const existing = await findProfileByIin(iin);
  if (existing && existing.id !== exceptUserId) {
    throw new Error("Этот ИИН уже привязан к другому аккаунту");
  }
}

export async function attachEdsToProfile(
  userId: string,
  iin: string,
  cert: CertInfo,
  displayName?: string,
  options?: { verifyCn?: boolean },
) {
  const existing = await findProfileByIin(iin);

  if (existing && existing.id !== userId) {
    if (isEdsPlaceholderEmail(existing.email)) {
      await mergeEdsPlaceholderInto(existing.id, userId, iin, cert, displayName);
      return;
    }
    throw new Error("Этот ИИН уже привязан к другому аккаунту");
  }

  if (options?.verifyCn) {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("full_name_ru, full_name_kk")
      .eq("id", userId)
      .single();

    if (error || !profile) throw new Error("Профиль не найден");

    if (!verifyCnMatchesProfile(cert, profile as { full_name_ru: string | null; full_name_kk: string | null })) {
      throw new Error(
        `CN сертификата (${displayNameFromCert(cert)}) не совпадает с ФИО в профиле. Обновите ФИО или выберите другой сертификат.`,
      );
    }
  }

  await applyEdsFields(userId, iin, cert, displayName);
}

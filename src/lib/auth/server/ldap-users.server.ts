import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LdapUserInfo } from "@/lib/auth/ldap.server";
import { emailMatchesDomainPolicy, type SystemSettings } from "@/lib/auth/policy";
import { assertUserBelongsToOrganization } from "@/lib/access/tenant-auth.server";
import { registerUser, setUserRole } from "./users";
import { requireAvailableSeat, requireWritableLicense } from "@/lib/api/_helpers";

function randomLdapPassword(): string {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

export async function resolveLdapLogin(
  ldapUser: LdapUserInfo,
  settings: SystemSettings,
  opts?: { organizationId?: string | null },
): Promise<{ userId: string; email: string }> {
  const email = ldapUser.email.toLowerCase().trim();
  const organizationId = opts?.organizationId ?? null;

  if (!emailMatchesDomainPolicy(email, settings.auth.allowed_email_domains)) {
    throw new Error("Домен email не разрешён политикой организации.");
  }

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name_ru, full_name_kk")
    .ilike("email", email)
    .maybeSingle();

  if (existing?.id) {
    await assertUserBelongsToOrganization(existing.id, organizationId);
    const displayName = ldapUser.displayName.trim();
    if (displayName) {
      await supabaseAdmin
        .from("profiles")
        .update({
          full_name_ru: displayName,
          full_name_kk: displayName,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", existing.id);
    }
    return { userId: existing.id, email };
  }

  if (!settings.ldap.auto_provision) {
    throw new Error(
      "Учётная запись не найдена в системе. Обратитесь к администратору для получения доступа.",
    );
  }

  await requireWritableLicense(supabaseAdmin);
  await requireAvailableSeat(supabaseAdmin);

  const displayName = ldapUser.displayName.trim() || ldapUser.username;
  const userId = await registerUser({
    email,
    password: randomLdapPassword(),
    full_name_ru: displayName,
    full_name_kk: displayName,
    auth_method: "ldap",
    organization_id: organizationId,
  });

  const defaultRole = settings.ldap.default_role;
  if (defaultRole !== "viewer") {
    await setUserRole(userId, defaultRole, true);
  }

  return { userId, email };
}

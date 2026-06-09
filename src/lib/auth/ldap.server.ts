import { Client } from "ldapts";
import type { LdapPolicySettings } from "@/lib/auth/policy";

export type LdapUserInfo = {
  dn: string;
  email: string;
  displayName: string;
  username: string;
};

export type LdapRuntimeConfig = {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string;
  emailAttr: string;
  displayNameAttr: string;
  rejectUnauthorized: boolean;
};

function escapeLdapFilter(value: string): string {
  return value
    .replace(/\\/g, "\\5c")
    .replace(/\*/g, "\\2a")
    .replace(/\(/g, "\\28")
    .replace(/\)/g, "\\29")
    .replace(/\0/g, "\\00");
}

function readAttr(entry: Record<string, unknown>, attr: string): string {
  const raw = entry[attr];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

export function buildLdapRuntimeConfig(settings: LdapPolicySettings): LdapRuntimeConfig | null {
  if (!settings.enabled) return null;

  const url = settings.url.trim();
  const baseDn = settings.base_dn.trim();
  const bindDn = settings.bind_dn.trim();
  const bindPassword = settings.bind_password.trim();

  if (!url || !baseDn || !bindDn || !bindPassword) return null;

  return {
    url,
    baseDn,
    bindDn,
    bindPassword,
    userFilter: settings.user_filter.trim() || "(&(objectClass=user)(sAMAccountName={{username}}))",
    emailAttr: settings.email_attr.trim() || "mail",
    displayNameAttr: settings.display_name_attr.trim() || "displayName",
    rejectUnauthorized: settings.reject_unauthorized,
  };
}

function createClient(config: LdapRuntimeConfig) {
  const tlsOptions = config.url.startsWith("ldaps://")
    ? { rejectUnauthorized: config.rejectUnauthorized }
    : undefined;
  return new Client({ url: config.url, tlsOptions, timeout: 10_000, connectTimeout: 10_000 });
}

export async function testLdapConnection(
  config: LdapRuntimeConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = createClient(config);
  try {
    await client.bind(config.bindDn, config.bindPassword);
    await client.search(config.baseDn, {
      scope: "base",
      filter: "(objectClass=*)",
      attributes: ["dn"],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

export async function authenticateLdapUser(
  username: string,
  password: string,
  config: LdapRuntimeConfig,
): Promise<LdapUserInfo | null> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password) return null;

  const filter = config.userFilter.replace(
    /\{\{username\}\}/g,
    escapeLdapFilter(normalizedUsername),
  );
  const client = createClient(config);

  let userDn = "";
  let email = "";
  let displayName = "";

  try {
    await client.bind(config.bindDn, config.bindPassword);
    const { searchEntries } = await client.search(config.baseDn, {
      scope: "sub",
      filter,
      attributes: [config.emailAttr, config.displayNameAttr, "dn"],
      sizeLimit: 2,
    });

    if (searchEntries.length !== 1) return null;

    const entry = searchEntries[0] as Record<string, unknown>;
    userDn = typeof entry.dn === "string" ? entry.dn : "";
    email = readAttr(entry, config.emailAttr).toLowerCase();
    displayName = readAttr(entry, config.displayNameAttr) || normalizedUsername;

    if (!userDn) return null;
  } catch {
    return null;
  } finally {
    await client.unbind().catch(() => undefined);
  }

  if (!email && normalizedUsername.includes("@")) {
    email = normalizedUsername.toLowerCase();
  }
  if (!email) return null;

  const userClient = createClient(config);
  try {
    await userClient.bind(userDn, password);
    return { dn: userDn, email, displayName, username: normalizedUsername };
  } catch {
    return null;
  } finally {
    await userClient.unbind().catch(() => undefined);
  }
}

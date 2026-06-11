import { createHmac } from "node:crypto";

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

import type { OnlyOfficeEditorConfig } from "@/lib/office/config.types";

/** Sign ONLYOFFICE editor config when JWT is enabled on Document Server. */
export function signOnlyOfficeConfig(config: OnlyOfficeEditorConfig): OnlyOfficeEditorConfig {
  const enabled = process.env.ONLYOFFICE_JWT_ENABLED === "true";
  const secret = process.env.ONLYOFFICE_JWT_SECRET?.trim();
  if (!enabled || !secret) return config;

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(config));
  const data = `${header}.${payload}`;
  const signature = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  return { token: `${data}.${signature}` };
}

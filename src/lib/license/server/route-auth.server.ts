import { isLicenseServerEnabled } from "./config.server";

export function licenseServerDisabledResponse(): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export function assertLicenseServerEnabled(): Response | null {
  if (!isLicenseServerEnabled()) return licenseServerDisabledResponse();
  return null;
}

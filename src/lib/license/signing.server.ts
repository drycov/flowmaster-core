import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const LICENSE_SIGNING_SEED_PREFIX = "flowmaster-license-signing:v1:";

/** HMAC secret derived from installation UUID (not JWT / shared vendor secret). */
export function licenseSigningSecretFromInstallationId(installationId: string): string {
  const id = installationId.trim().toLowerCase();
  if (!id) {
    throw new Error("INSTALLATION_ID обязателен для подписи лицензии");
  }
  return createHash("sha256").update(`${LICENSE_SIGNING_SEED_PREFIX}${id}`).digest("hex");
}

export function signLicensePayload(encodedPayload: string, installationId: string): string {
  const sig = createHmac("sha256", licenseSigningSecretFromInstallationId(installationId))
    .update(encodedPayload)
    .digest();
  return sig.toString("base64url");
}

export function verifyLicenseSignature(
  encodedPayload: string,
  encodedSig: string,
  installationId: string,
): boolean {
  const expected = signLicensePayload(encodedPayload, installationId);
  const a = Buffer.from(encodedSig, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

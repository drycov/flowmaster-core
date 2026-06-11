import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const LICENSE_SIGNING_SEED_PREFIX = "flowmaster-license-signing:v1:";

export function licenseSigningSecretFromInstallationId(installationId) {
  const id = installationId.trim().toLowerCase();
  if (!id) throw new Error("INSTALLATION_ID is required for license signing");
  return createHash("sha256").update(`${LICENSE_SIGNING_SEED_PREFIX}${id}`).digest("hex");
}

export function signLicensePayload(encodedPayload, installationId) {
  return createHmac("sha256", licenseSigningSecretFromInstallationId(installationId))
    .update(encodedPayload)
    .digest("base64url");
}

export function verifyLicenseSignature(encodedPayload, encodedSig, installationId) {
  const expected = signLicensePayload(encodedPayload, installationId);
  const a = Buffer.from(encodedSig, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

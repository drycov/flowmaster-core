export function hasE2eCredentials(): boolean {
  return Boolean(process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim());
}

export function requireE2eCredentials(): { email: string; password: string } {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD to run integration smoke tests.");
  }
  return { email, password };
}

export function hasTenantIsolationE2e(): boolean {
  return Boolean(
    process.env.E2E_TENANT_B_EMAIL?.trim() &&
      process.env.E2E_TENANT_B_PASSWORD?.trim() &&
      process.env.E2E_CROSS_TENANT_DOCUMENT_ID?.trim(),
  );
}

export function requireTenantIsolationE2e(): {
  email: string;
  password: string;
  documentId: string;
} {
  const email = process.env.E2E_TENANT_B_EMAIL?.trim();
  const password = process.env.E2E_TENANT_B_PASSWORD?.trim();
  const documentId = process.env.E2E_CROSS_TENANT_DOCUMENT_ID?.trim();
  if (!email || !password || !documentId) {
    throw new Error(
      "Set E2E_TENANT_B_EMAIL, E2E_TENANT_B_PASSWORD, and E2E_CROSS_TENANT_DOCUMENT_ID.",
    );
  }
  return { email, password, documentId };
}

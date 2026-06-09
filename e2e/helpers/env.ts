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

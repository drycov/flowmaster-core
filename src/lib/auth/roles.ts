export const APP_ROLES = [
  "admin",
  "platform_admin",
  "registrar",
  "approver",
  "signer",
  "archivist",
  "viewer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** PostgREST embed hints — profiles↔departments has two FK paths (department_id + head_user_id). */
export const PROFILE_SELECT =
  "*, departments!profiles_department_id_fkey(id, name_ru, name_kk, code), positions!profiles_position_id_fkey(id, title_ru, title_kk, code)";

export const APP_ROLES = [
  "admin",
  "registrar",
  "approver",
  "signer",
  "archivist",
  "viewer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

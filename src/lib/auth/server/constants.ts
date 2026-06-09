/** PostgREST embed hints — profiles↔departments has two FK paths (department_id + head_user_id). */
export const PROFILE_SELECT =
  "*, departments!profiles_department_id_fkey(id, name_ru, name_kk, code), positions!profiles_position_id_fkey(id, title_ru, title_kk, code)";

export { APP_ROLES, type AppRole } from "@/lib/auth/roles";

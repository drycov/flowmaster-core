import { Role } from "./roles";

export interface ApiUser {
  id: string;
  email: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  roles?: string[];
  created_at?: string;
  last_sign_in_at?: string;
}

export interface User {
  id: string;
  email: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  roles: Role[];
  created_at?: string;
  last_sign_in_at?: string;
}
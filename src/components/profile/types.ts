// src/components/profile/types.ts
export interface UserProfile {
  id: string;
  email: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  avatar_url?: string | null;
  roles: string[];
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  auth_method?: "email" | "eds" | "both";
  iin?: string | null;
  has_password?: boolean;
  has_eds?: boolean;
}

export interface ProfileFormData {
  full_name_ru: string;
  full_name_kk: string;
  phone: string;
  department: string;
  position: string;
}

export interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserProfileDTO {
  id: string;
  email: string;
  full_name_ru: string | null;
  full_name_kk: string | null;
  avatar_url: string | null;

  roles: string[];

  department: {
    id: string | null;
    name_ru?: string;
    name_kk?: string;
  } | null;

  position: {
    id: string | null;
    title_ru?: string;
    title_kk?: string;
  } | null;

  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
}
export type AuthMode = "signin" | "signup";

export interface AuthFormData {
  email: string;
  password: string;
  fullName?: string;
}
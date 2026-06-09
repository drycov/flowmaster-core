import { useState, useCallback } from "react";
import type { AuthMode } from "../types";

interface UseAuthFormReturn {
  mode: AuthMode;
  email: string;
  password: string;
  passwordConfirm: string;
  fullNameRu: string;
  fullNameKk: string;
  tenantSlug: string;
  orgNameRu: string;
  orgNameKk: string;
  setMode: (mode: AuthMode) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setPasswordConfirm: (value: string) => void;
  setFullNameRu: (name: string) => void;
  setFullNameKk: (name: string) => void;
  setTenantSlug: (value: string) => void;
  setOrgNameRu: (value: string) => void;
  setOrgNameKk: (value: string) => void;
  switchMode: () => void;
  resetForm: () => void;
}

export function useAuthForm(initialMode: AuthMode = "signin"): UseAuthFormReturn {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fullNameRu, setFullNameRu] = useState("");
  const [fullNameKk, setFullNameKk] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [orgNameRu, setOrgNameRu] = useState("");
  const [orgNameKk, setOrgNameKk] = useState("");

  const switchMode = useCallback(() => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setFullNameRu("");
    setFullNameKk("");
    setTenantSlug("");
    setOrgNameRu("");
    setOrgNameKk("");
  }, []);

  const resetForm = useCallback(() => {
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setFullNameRu("");
    setFullNameKk("");
    setTenantSlug("");
    setOrgNameRu("");
    setOrgNameKk("");
  }, []);

  return {
    mode,
    email,
    password,
    passwordConfirm,
    fullNameRu,
    fullNameKk,
    tenantSlug,
    orgNameRu,
    orgNameKk,
    setMode,
    setEmail,
    setPassword,
    setPasswordConfirm,
    setFullNameRu,
    setFullNameKk,
    setTenantSlug,
    setOrgNameRu,
    setOrgNameKk,
    switchMode,
    resetForm,
  };
}

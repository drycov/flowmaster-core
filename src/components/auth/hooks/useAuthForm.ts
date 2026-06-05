import { useState, useCallback } from "react";
import type { AuthMode } from "../types";

interface UseAuthFormReturn {
  mode: AuthMode;
  email: string;
  password: string;
  fullName: string;
  setMode: (mode: AuthMode) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setFullName: (name: string) => void;
  switchMode: () => void;
  resetForm: () => void;
}

export function useAuthForm(): UseAuthFormReturn {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const switchMode = useCallback(() => {
    setMode(prev => prev === "signin" ? "signup" : "signin");
    setEmail("");
    setPassword("");
    setFullName("");
  }, []);

  const resetForm = useCallback(() => {
    setEmail("");
    setPassword("");
    setFullName("");
  }, []);

  return {
    mode,
    email,
    password,
    fullName,
    setMode,
    setEmail,
    setPassword,
    setFullName,
    switchMode,
    resetForm,
  };
}
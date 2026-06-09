import { z } from "zod";

export const signInInputSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
  tenantSlug: z.string().trim().optional(),
});

export const signUpInputSchema = signInInputSchema.extend({
  fullNameRu: z.string().trim().min(1),
  fullNameKk: z.string().trim().min(1),
  tenantSlug: z.string().trim().optional(),
  orgNameRu: z.string().trim().optional(),
  orgNameKk: z.string().trim().optional(),
});

type Translate = (key: string) => string;

const fieldMessageKey: Record<string, string> = {
  email: "auth.error.invalidEmail",
  password: "auth.error.passwordRequired",
  fullNameRu: "auth.error.fullNameRequired",
  fullNameKk: "auth.error.fullNameRequired",
  tenantSlug: "auth.error.tenantSlugRequired",
};

export function formatAuthValidationIssues(issues: z.ZodIssue[], t: Translate): string {
  const messages = issues.map((issue) => {
    const field = String(issue.path[0] ?? "");
    const key = fieldMessageKey[field];
    return key ? t(key) : issue.message;
  });
  return [...new Set(messages)].join(". ");
}

export function parseServerValidationError(message: string, t: Translate): string | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Array<{ path?: Array<string | number> }>;
    if (!Array.isArray(parsed)) return null;
    const messages = parsed.map((item) => {
      const field = String(item.path?.[0] ?? "");
      const key = fieldMessageKey[field];
      return key ? t(key) : "";
    });
    const formatted = [...new Set(messages.filter(Boolean))].join(". ");
    return formatted || null;
  } catch {
    return null;
  }
}

export function resolveEdsLinkCredentials(
  email: string,
  password: string,
): { linkEmail?: string; linkPassword?: string } {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) return {};
  const check = signInInputSchema.safeParse({ email: trimmedEmail, password });
  if (!check.success) return {};
  return { linkEmail: check.data.email, linkPassword: check.data.password };
}

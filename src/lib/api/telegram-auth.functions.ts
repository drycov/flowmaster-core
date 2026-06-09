import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { publishAuthSession } from "@/lib/auth/server/publish-session.server";
import { resolveAuthOrganizationFromRequest } from "@/lib/access/tenant-auth.server";
import {
  confirmTelegramPasswordReset,
  createTelegramLoginSession,
  pollTelegramLogin,
  requestTelegramPasswordReset,
} from "@/lib/telegram/auth.server";

export const startTelegramLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { getTelegramDeliveryMode, pollTelegramUpdatesOnce } = await import(
    "@/lib/telegram/polling.server",
  );
  if ((await getTelegramDeliveryMode()) === "polling") {
    void pollTelegramUpdatesOnce(0);
  }
  return createTelegramLoginSession();
});

export const completeTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().min(16).max(64),
      tenant_slug: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const organizationId = await resolveAuthOrganizationFromRequest({
      tenantSlug: data.tenant_slug,
      hostHeader: request?.headers?.get("host") ?? null,
    });
    const result = await pollTelegramLogin(data.token, { organizationId });
    if (result.status === "ok" && result.refresh_token) {
      const published = publishAuthSession(result);
      return { status: "ok" as const, ...published };
    }
    return result;
  });

export const requestPasswordResetTelegram = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email(),
      tenant_slug: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const organizationId = await resolveAuthOrganizationFromRequest({
      tenantSlug: data.tenant_slug,
      hostHeader: request?.headers?.get("host") ?? null,
    });
    return requestTelegramPasswordReset(data.email, { organizationId });
  });

export const confirmPasswordResetTelegram = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email(),
      code: z.string().trim().min(4).max(12),
      password: z.string().min(1),
      tenant_slug: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const organizationId = await resolveAuthOrganizationFromRequest({
      tenantSlug: data.tenant_slug,
      hostHeader: request?.headers?.get("host") ?? null,
    });
    await confirmTelegramPasswordReset(data.email, data.code, data.password, {
      organizationId,
    });
    return { ok: true };
  });

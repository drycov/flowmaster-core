import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireIntegrationsAccess } from "../_helpers";
import {
  API_KEY_SCOPES,
  WEBHOOK_EVENTS,
  WEBHOOK_EVENTS_ACTIVE,
  type ApiKeyScope,
} from "@/lib/integrations/constants";

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireIntegrationsAccess(supabaseAdmin, context.userId);
    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1).max(120),
      scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
      expires_at: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireIntegrationsAccess(supabaseAdmin, context.userId);
    const { generateApiKeyMaterial } = await import("@/lib/integrations/api-key-auth.server");
    const { raw, hash, prefix } = generateApiKeyMaterial();

    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        name: data.name.trim(),
        key_prefix: prefix,
        key_hash: hash,
        scopes: data.scopes,
        created_by: context.userId,
        expires_at: data.expires_at ?? null,
      } as never)
      .select("id, name, key_prefix, scopes, created_at")
      .single();

    if (error) throw new Error(error.message);
    return { ...row, secret: raw };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireIntegrationsAccess(supabaseAdmin, context.userId);
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ is_active: false } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWebhookSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireIntegrationsAccess(supabaseAdmin, context.userId);
    const { data, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .select("id, name, url, events, is_active, created_at, secret")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => ({
      ...s,
      secret: `${String(s.secret).slice(0, 8)}…`,
    }));
  });

export const createWebhookSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1).max(120),
      url: z.string().url(),
      events: z.array(z.enum(WEBHOOK_EVENTS_ACTIVE)).min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireIntegrationsAccess(supabaseAdmin, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .insert({
        name: data.name.trim(),
        url: data.url.trim(),
        events: data.events,
        created_by: context.userId,
      } as never)
      .select("id, name, url, events, secret, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleWebhookSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      is_active: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireIntegrationsAccess(supabaseAdmin, context.userId);
    const { error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .update({ is_active: data.is_active } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listImportJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireIntegrationsAccess(supabaseAdmin, context.userId);
    const { data, error } = await supabaseAdmin
      .from("import_jobs")
      .select(
        "id, kind, status, source, total_count, success_count, error_count, created_at, completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const testWebhookSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireIntegrationsAccess(supabaseAdmin, context.userId);

    const { data: sub, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .select("id, url, secret, is_active")
      .eq("id", data.id)
      .single();

    if (error || !sub) throw new Error("Webhook not found");
    if (!sub.is_active) throw new Error("Webhook is disabled");

    const payload = JSON.stringify({
      event: "webhook.test",
      payload: { message: "Flowmaster test delivery" },
      timestamp: new Date().toISOString(),
    });

    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", sub.secret as string)
      .update(payload)
      .digest("hex");

    const res = await fetch(sub.url as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Flowmaster-Event": "webhook.test",
        "X-Flowmaster-Signature": signature,
      },
      body: payload,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`Delivery failed: HTTP ${res.status}`);
    }

    return { ok: true, status: res.status };
  });

export { API_KEY_SCOPES, WEBHOOK_EVENTS, WEBHOOK_EVENTS_ACTIVE };
export type { ApiKeyScope };

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { requireModuleAccess, requirePermission } from "./_helpers";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || `article-${Date.now()}`;
}

export const listKbCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listKbCategoriesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(context.supabase, context.userId, "knowledge_base", { action: "manage" });
    const { data, error } = await context.supabase
      .from("kb_categories")
      .select("*")
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertKbCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      code: z.string().min(1).max(64),
      name_ru: z.string().min(1),
      name_kk: z.string().min(1),
      sort_order: z.number().int().optional(),
      is_active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "knowledge_base", {
      action: "manage",
    });

    const payload = {
      code: data.code.trim(),
      name_ru: data.name_ru.trim(),
      name_kk: data.name_kk.trim(),
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
    };

    const row = await upsertRow({
      supabase: context.supabase,
      table: "kb_categories",
      row: payload,
      id: data.id,
    });
    return { id: String(row.id) };
  });

export const listKbArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        search: z.string().optional(),
        category_id: z.string().uuid().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        include_all: z.boolean().optional(),
        limit: z.number().min(1).max(200).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("kb_articles")
      .select(
        "id, slug, category_id, source_document_id, title_ru, title_kk, summary_ru, summary_kk, tags, status, published_at, author_id, kb_categories(id, code, name_ru, name_kk)",
      )
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data?.limit ?? 100);

    if (data?.category_id) q = q.eq("category_id", data.category_id);

    if (data?.include_all) {
      await requireModuleAccess(context.supabase, context.userId, "knowledge_base", { action: "manage" });
    } else if (data?.status) {
      q = q.eq("status", data.status);
    } else {
      q = q.eq("status", "published");
    }

    if (data?.search?.trim()) {
      q = q.or(
        `title_ru.ilike.%${data.search.trim()}%,title_kk.ilike.%${data.search.trim()}%,summary_ru.ilike.%${data.search.trim()}%`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getKbArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kb_articles")
      .select(
        "*, kb_categories(id, code, name_ru, name_kk), documents:source_document_id(id, reg_number, title_ru, title_kk, status)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Article not found");
    return row;
  });

export const upsertKbArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      category_id: z.string().uuid().nullable().optional(),
      source_document_id: z.string().uuid().nullable().optional(),
      title_ru: z.string().min(1),
      title_kk: z.string().min(1),
      summary_ru: z.string().optional(),
      summary_kk: z.string().optional(),
      body_ru: z.string().optional(),
      body_kk: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      slug: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "knowledge_base", {
      action: "manage",
    });
    const { supabase, userId } = context;

    if (data.id) {
      const canManage = await requirePermission(supabase, userId, "manage_knowledge_base").then(
        () => true,
        () => false,
      );
      if (!canManage) {
        const { data: existing } = await supabase
          .from("kb_articles")
          .select("author_id")
          .eq("id", data.id)
          .maybeSingle();
        if (existing?.author_id !== userId) throw new Error("Forbidden");
      }

      const { data: existingRow } = await supabase
        .from("kb_articles")
        .select("status, published_at, author_id, slug")
        .eq("id", data.id)
        .maybeSingle();

      const nextStatus = data.status ?? (existingRow as { status?: string } | null)?.status ?? "draft";
      const patch: Record<string, unknown> = {
        category_id: data.category_id ?? null,
        source_document_id: data.source_document_id ?? null,
        title_ru: data.title_ru,
        title_kk: data.title_kk,
        summary_ru: data.summary_ru ?? "",
        summary_kk: data.summary_kk ?? "",
        body_ru: data.body_ru ?? "",
        body_kk: data.body_kk ?? "",
        tags: data.tags ?? [],
        slug: data.slug?.trim() || (existingRow as { slug?: string } | null)?.slug || slugify(data.title_ru),
      };

      if (data.status !== undefined) {
        patch.status = nextStatus;
        if (nextStatus === "published") {
          patch.published_at =
            (existingRow as { published_at?: string | null } | null)?.published_at ??
            new Date().toISOString();
        } else if (nextStatus === "draft") {
          patch.published_at = null;
        }
      }

      await upsertRow({
        supabase,
        table: "kb_articles",
        row: patch,
        id: data.id,
      });
      return { id: data.id };
    }

    const row = await upsertRow({
      supabase,
      table: "kb_articles",
      row: {
        category_id: data.category_id ?? null,
        source_document_id: data.source_document_id ?? null,
        title_ru: data.title_ru,
        title_kk: data.title_kk,
        summary_ru: data.summary_ru ?? "",
        summary_kk: data.summary_kk ?? "",
        body_ru: data.body_ru ?? "",
        body_kk: data.body_kk ?? "",
        tags: data.tags ?? [],
        status: data.status ?? "draft",
        slug: data.slug?.trim() || slugify(data.title_ru),
        published_at: data.status === "published" ? new Date().toISOString() : null,
      },
      insertOnly: { author_id: userId },
    });
    return { id: String(row.id) };
  });

export const publishDocumentToKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      category_id: z.string().uuid().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "knowledge_base", {
      action: "manage",
    });
    const { supabase, userId } = context;

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, reg_number, title_ru, title_kk, summary, body, access_level_id, status")
      .eq("id", data.document_id)
      .maybeSingle();
    if (docErr) throw new Error(docErr.message);
    if (!doc) throw new Error("Document not found");
    if (!["approved", "signed", "archived"].includes(doc.status as string)) {
      throw new Error("Only approved or signed documents can be published to KB");
    }

    const slug = slugify(`${doc.reg_number}-${doc.title_ru}`);

    const { data: existing } = await supabase
      .from("kb_articles")
      .select("id")
      .eq("source_document_id", data.document_id)
      .maybeSingle();

    const payload = {
      category_id: data.category_id ?? null,
      source_document_id: data.document_id,
      title_ru: doc.title_ru as string,
      title_kk: (doc.title_kk as string) || (doc.title_ru as string),
      summary_ru: (doc.summary as string) || "",
      summary_kk: (doc.summary as string) || "",
      body_ru: (doc.body as string) || "",
      body_kk: (doc.body as string) || "",
      tags: data.tags ?? [],
      status: "published" as const,
      slug,
      access_level_id: doc.access_level_id as string | null,
      author_id: userId,
      published_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase.from("kb_articles").update(payload as never).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }

    const { data: row, error } = await supabase
      .from("kb_articles")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertCanManageDocumentAccessGrants } from "@/lib/api/document-access-grants.server";
import { fetchDocumentSummaryById } from "@/lib/documents/documents-read.server";

export type DocumentAccessGrant = {
  id: string;
  document_id: string;
  user_id: string;
  status: string;
  reason: string;
  review_note: string | null;
  expires_at: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles?: {
    full_name_ru: string;
    full_name_kk: string;
    email: string;
  } | null;
};

export const getDocumentAccessState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: canView }, { data: canViewContent }, { data: grant }] = await Promise.all([
      supabaseAdmin.rpc(
        "can_view_document" as never,
        {
          _doc_id: data.document_id,
          _user: userId,
        } as never,
      ),
      supabaseAdmin.rpc(
        "can_view_document_content" as never,
        {
          _doc_id: data.document_id,
          _user: userId,
        } as never,
      ),
      supabase
        .from("document_access_grants")
        .select("id, status, reason, review_note, expires_at, created_at, reviewed_at")
        .eq("document_id", data.document_id)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const docMeta = await fetchDocumentSummaryById(supabaseAdmin, data.document_id);

    return {
      document_id: data.document_id,
      exists: !!docMeta,
      can_view: !!canView,
      can_view_content: !!canViewContent,
      grant: grant ?? null,
      document: docMeta
        ? {
            reg_number: docMeta.reg_number as string,
            title_ru: docMeta.title_ru as string,
            title_kk: docMeta.title_kk as string | null,
            status: docMeta.status as string,
            created_by: docMeta.created_by as string,
            access_level: docMeta.ref_access_levels ?? null,
          }
        : null,
    };
  });

export const requestDocumentAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      reason: z.string().min(3).max(1000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const docMeta = await fetchDocumentSummaryById(supabaseAdmin, data.document_id);
    if (!docMeta) throw new Error("Документ не найден");

    const { data: canViewContent } = await supabaseAdmin.rpc(
      "can_view_document_content" as never,
      { _doc_id: data.document_id, _user: userId } as never,
    );
    if (canViewContent) {
      throw new Error("У вас уже есть доступ к этому документу");
    }

    const { data: row, error } = await supabase
      .from("document_access_grants")
      .upsert(
        {
          document_id: data.document_id,
          user_id: userId,
          requested_by: userId,
          status: "pending",
          reason: data.reason.trim(),
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
        } as never,
        { onConflict: "document_id,user_id" },
      )
      .select("id, status, created_at")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const listDocumentAccessGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      status: z.enum(["pending", "approved", "rejected", "revoked"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageDocumentAccessGrants(supabase, userId, data.document_id);

    let q = supabase
      .from("document_access_grants")
      .select(
        "id, document_id, user_id, status, reason, review_note, expires_at, created_at, reviewed_at, profiles!document_access_grants_user_id_fkey(full_name_ru, full_name_kk, email)",
      )
      .eq("document_id", data.document_id)
      .order("created_at", { ascending: false });

    if (data.status) q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as DocumentAccessGrant[];
  });

export const resolveDocumentAccessGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      grant_id: z.string().uuid(),
      decision: z.enum(["approved", "rejected", "revoked"]),
      review_note: z.string().max(500).optional().nullable(),
      expires_at: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: grant, error: readErr } = await supabase
      .from("document_access_grants")
      .select("id, document_id, status")
      .eq("id", data.grant_id)
      .single();
    if (readErr || !grant) throw new Error("Запрос доступа не найден");

    await assertCanManageDocumentAccessGrants(
      supabase,
      userId,
      (grant as { document_id: string }).document_id,
    );

    const { error } = await supabase
      .from("document_access_grants")
      .update({
        status: data.decision,
        review_note: data.review_note?.trim() || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        expires_at: data.decision === "approved" ? (data.expires_at ?? null) : null,
      } as never)
      .eq("id", data.grant_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

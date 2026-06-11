import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireModuleAccess } from "../_helpers";

const LINK_DOC_SELECT = "id, reg_number, title_ru, title_kk, status, doc_type, created_at";

const LINK_TYPE_SELECT = "id, code, name_ru, name_kk";

export const listDocumentLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const docId = data.document_id;

    const { data: canView, error: viewErr } = await supabaseAdmin.rpc(
      "can_view_document" as never,
      {
        _doc_id: docId,
        _user: userId,
      } as never,
    );
    if (viewErr) throw new Error(viewErr.message);
    if (!canView) throw new Error("Forbidden");

    const [outgoing, incoming] = await Promise.all([
      supabase
        .from("document_links")
        .select(
          `id, note, created_at, created_by,
           link_type:ref_document_link_types!document_links_link_type_id_fkey(${LINK_TYPE_SELECT}),
           target:documents!document_links_target_document_id_fkey(${LINK_DOC_SELECT})`,
        )
        .eq("source_document_id", docId)
        .order("created_at", { ascending: false }),
      supabase
        .from("document_links")
        .select(
          `id, note, created_at, created_by,
           link_type:ref_document_link_types!document_links_link_type_id_fkey(${LINK_TYPE_SELECT}),
           source:documents!document_links_source_document_id_fkey(${LINK_DOC_SELECT})`,
        )
        .eq("target_document_id", docId)
        .order("created_at", { ascending: false }),
    ]);

    if (outgoing.error) throw new Error(outgoing.error.message);
    if (incoming.error) throw new Error(incoming.error.message);

    return {
      outgoing: outgoing.data ?? [],
      incoming: incoming.data ?? [],
    };
  });

export const createDocumentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      source_document_id: z.string().uuid(),
      target_document_id: z.string().uuid(),
      link_type_id: z.string().uuid(),
      note: z.string().max(500).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;

    if (data.source_document_id === data.target_document_id) {
      throw new Error("Нельзя связать документ с самим собой");
    }

    const [{ data: canViewSource }, { data: canViewTarget }] = await Promise.all([
      supabaseAdmin.rpc(
        "can_view_document" as never,
        {
          _doc_id: data.source_document_id,
          _user: userId,
        } as never,
      ),
      supabaseAdmin.rpc(
        "can_view_document" as never,
        {
          _doc_id: data.target_document_id,
          _user: userId,
        } as never,
      ),
    ]);
    if (!canViewSource || !canViewTarget) {
      throw new Error("Forbidden");
    }

    const { data: row, error } = await supabase
      .from("document_links")
      .insert({
        source_document_id: data.source_document_id,
        target_document_id: data.target_document_id,
        link_type_id: data.link_type_id,
        note: data.note ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDocumentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: link, error: linkErr } = await supabase
      .from("document_links")
      .select("id, created_by")
      .eq("id", data.id)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link) throw new Error("Связь не найдена");

    if ((link as { created_by: string }).created_by !== userId) {
      const { data: isAdmin, error: adminErr } = await supabaseAdmin.rpc(
        "is_admin" as never,
        { _user_id: userId } as never,
      );
      if (adminErr) throw new Error(adminErr.message);
      if (!isAdmin) throw new Error("Forbidden");
    }

    const { error } = await supabase.from("document_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

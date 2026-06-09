import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";

export const listCounterparties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        search: z.string().optional(),
        correspondent_type: z.enum(["legal", "individual", "government"]).optional(),
        active_only: z.boolean().optional(),
        limit: z.number().min(1).max(500).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ref_correspondents")
      .select("*")
      .order("name_ru")
      .limit(data?.limit ?? 200);

    if (data?.active_only !== false) q = q.eq("is_active", true);
    if (data?.correspondent_type) q = q.eq("correspondent_type", data.correspondent_type);
    if (data?.search?.trim()) {
      const s = data.search.trim();
      q = q.or(
        `name_ru.ilike.%${s}%,name_kk.ilike.%${s}%,code.ilike.%${s}%,bin.ilike.%${s}%,email.ilike.%${s}%`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("ref_correspondents")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Counterparty not found");

    const [docsRes, contractsRes, partiesRes] = await Promise.all([
      supabase
        .from("documents")
        .select("id, reg_number, title_ru, title_kk, status, created_at, ref_document_types(code, name_ru)")
        .eq("correspondent_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("contract_details")
        .select(
          "document_id, contract_number, contract_status, valid_from, valid_to, amount, currency, documents(id, reg_number, title_ru, status)",
        )
        .eq("counterparty_id", data.id)
        .order("valid_to", { ascending: false, nullsFirst: false })
        .limit(50),
      supabase
        .from("document_correspondents")
        .select("document_id, role, documents(id, reg_number, title_ru, status)")
        .eq("correspondent_id", data.id)
        .limit(50),
    ]);

    if (docsRes.error) throw new Error(docsRes.error.message);
    if (contractsRes.error) throw new Error(contractsRes.error.message);
    if (partiesRes.error) throw new Error(partiesRes.error.message);

    return {
      ...row,
      documents: docsRes.data ?? [],
      contracts: contractsRes.data ?? [],
      party_links: partiesRes.data ?? [],
    };
  });

export const upsertDocumentCorrespondent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      correspondent_id: z.string().uuid(),
      role: z.enum(["sender", "recipient", "counterparty", "witness", "other"]).default("counterparty"),
      is_primary: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await upsertRow({
      supabase: context.supabase,
      table: "document_correspondents",
      row: {
        document_id: data.document_id,
        correspondent_id: data.correspondent_id,
        role: data.role,
        is_primary: data.is_primary ?? false,
      },
      onConflict: "document_id,correspondent_id,role",
    });

    if (data.is_primary) {
      await context.supabase
        .from("documents")
        .update({ correspondent_id: data.correspondent_id } as never)
        .eq("id", data.document_id);
    }

    return { ok: true };
  });

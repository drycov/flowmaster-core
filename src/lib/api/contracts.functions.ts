import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { enforceModuleLicense, requireAnyPermission, requireModuleAccess } from "./_helpers";

const CONTRACT_SELECT = `
  document_id, contract_number, contract_date, valid_from, valid_to,
  amount, currency, contract_status, counterparty_id, subject_ru, subject_kk,
  payment_terms, auto_renew, created_at, updated_at,
  documents!contract_details_document_id_fkey(
    id, reg_number, title_ru, title_kk, status, created_at, correspondent_id,
    ref_correspondents(id, code, name_ru, name_kk, bin)
  ),
  ref_correspondents!contract_details_counterparty_id_fkey(id, code, name_ru, name_kk, bin)
`;

export const listContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        search: z.string().optional(),
        contract_status: z.string().optional(),
        counterparty_id: z.string().uuid().optional(),
        expiring_within_days: z.number().int().optional(),
        limit: z.number().min(1).max(200).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "contracts", "read");
    let q = context.supabase
      .from("contract_details")
      .select(CONTRACT_SELECT)
      .order("valid_to", { ascending: true, nullsFirst: false })
      .limit(data?.limit ?? 100);

    if (data?.contract_status) q = q.eq("contract_status", data.contract_status);
    if (data?.counterparty_id) q = q.eq("counterparty_id", data.counterparty_id);

    if (data?.expiring_within_days) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + data.expiring_within_days);
      q = q
        .eq("contract_status", "active")
        .not("valid_to", "is", null)
        .lte("valid_to", horizon.toISOString().slice(0, 10));
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let result = rows ?? [];
    if (data?.search?.trim()) {
      const s = data.search.trim().toLowerCase();
      result = result.filter(
        (r: {
          contract_number?: string;
          subject_ru?: string;
          documents?: { reg_number?: string; title_ru?: string };
        }) => {
          const doc = r.documents as { reg_number?: string; title_ru?: string } | null;
          return (
            r.contract_number?.toLowerCase().includes(s) ||
            r.subject_ru?.toLowerCase().includes(s) ||
            doc?.reg_number?.toLowerCase().includes(s) ||
            doc?.title_ru?.toLowerCase().includes(s)
          );
        },
      );
    }
    return result;
  });

export const getContractDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "contracts", "read");
    const { data: row, error } = await context.supabase
      .from("contract_details")
      .select(CONTRACT_SELECT)
      .eq("document_id", data.document_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertContractDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      contract_number: z.string().optional(),
      contract_date: z.string().nullable().optional(),
      valid_from: z.string().nullable().optional(),
      valid_to: z.string().nullable().optional(),
      amount: z.number().nullable().optional(),
      currency: z.string().optional(),
      contract_status: z
        .enum(["draft", "negotiation", "active", "expired", "terminated"])
        .optional(),
      counterparty_id: z.string().uuid().nullable().optional(),
      subject_ru: z.string().optional(),
      subject_kk: z.string().optional(),
      payment_terms: z.string().optional(),
      auto_renew: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "contracts", "write");
    const { supabase, userId } = context;

    const canManage =
      (await requireAnyPermission(supabase, userId, ["manage_contracts"]).then(
        () => true,
        () => false,
      )) ||
      (await requireAnyPermission(supabase, userId, ["manage_documents"]).then(
        () => true,
        () => false,
      ));

    if (!canManage) {
      const { data: doc } = await supabase
        .from("documents")
        .select("created_by")
        .eq("id", data.document_id)
        .maybeSingle();
      if (doc?.created_by !== userId) throw new Error("Forbidden");
    }

    const payload = {
      document_id: data.document_id,
      contract_number: data.contract_number ?? "",
      contract_date: data.contract_date ?? null,
      valid_from: data.valid_from ?? null,
      valid_to: data.valid_to ?? null,
      amount: data.amount ?? null,
      currency: data.currency ?? "KZT",
      contract_status: data.contract_status ?? "draft",
      counterparty_id: data.counterparty_id ?? null,
      subject_ru: data.subject_ru ?? "",
      subject_kk: data.subject_kk ?? "",
      payment_terms: data.payment_terms ?? "",
      auto_renew: data.auto_renew ?? false,
    };

    await upsertRow({
      supabase,
      table: "contract_details",
      row: payload,
      onConflict: "document_id",
    });

    if (data.counterparty_id) {
      await supabase
        .from("documents")
        .update({ correspondent_id: data.counterparty_id } as never)
        .eq("id", data.document_id);
    }

    return { ok: true };
  });

export const ensureContractFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: existing } = await supabase
      .from("contract_details")
      .select("document_id")
      .eq("document_id", data.document_id)
      .maybeSingle();
    if (existing) return existing;

    const { data: doc } = await supabase
      .from("documents")
      .select("id, reg_number, title_ru, title_kk, correspondent_id")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");

    await upsertRow({
      supabase,
      table: "contract_details",
      row: {
        document_id: data.document_id,
        contract_number: doc.reg_number as string,
        subject_ru: doc.title_ru as string,
        subject_kk: (doc.title_kk as string) || (doc.title_ru as string),
        counterparty_id: doc.correspondent_id as string | null,
        contract_status: "draft",
      },
    });
    return { document_id: data.document_id };
  });

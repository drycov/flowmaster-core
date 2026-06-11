import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceModuleLicense } from "./_helpers";
import { assertCanManageDocumentAccessGrants } from "@/lib/api/document-access-grants.server";
import { CONTENT_MASK, DOCUMENT_FULL_LIST_SELECT } from "./documents.shared.server";
import { resolveDocumentTypeByCode } from "@/lib/documents/reference-fields.server";
import {
  enrichDocumentListRows,
  enrichFtsSearchRows,
  fetchDocumentById,
  type DocumentFtsRow,
  type DocumentListRow,
  type DocumentListRowEnriched,
} from "@/lib/documents/documents-read.server";

export type { DocumentListRowEnriched };

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        status: z.string().nullable().optional(),
        search: z.string().nullable().optional(),
        scope: z.enum(["all", "mine", "assigned", "archive"]).optional(),
        document_type_code: z.string().nullable().optional(),
        legal_hold_only: z.boolean().optional(),
        retention_expiring: z.boolean().optional(),
        limit: z.number().min(1).max(200).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data?.scope === "archive") {
      await enforceModuleLicense(supabase, "archive", "read");
    }

    if (data?.search && data.search.trim().length >= 2) {
      const { data: rows, error } = await supabaseAdmin.rpc(
        "search_documents_fts" as never,
        {
          _query: data.search.trim(),
          _status: data?.status ?? null,
          _document_type_code: data?.document_type_code ?? null,
          _scope_user: userId,
          _scope: data?.scope ?? "all",
          _limit: data?.limit ?? 100,
        } as never,
      );
      if (error) throw new Error(error.message);
      return enrichFtsSearchRows(supabase, (rows ?? []) as DocumentFtsRow[]);
    }

    let q = supabase
      .from("documents_full" as never)
      .select(DOCUMENT_FULL_LIST_SELECT)
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.status) q = q.eq("status" as never, data.status as never);
    if (data?.scope === "mine") q = q.eq("created_by" as never, userId);
    if (data?.scope === "assigned") q = q.eq("assigned_to" as never, userId);
    if (data?.scope === "archive") q = q.eq("status" as never, "archived" as never);
    if (data?.legal_hold_only) q = q.eq("legal_hold" as never, true);
    if (data?.retention_expiring) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      q = q
        .eq("legal_hold" as never, false)
        .not("retention_due_at" as never, "is", null)
        .lte("retention_due_at" as never, horizon.toISOString())
        .in("status" as never, ["approved", "signed", "in_review"]);
    }
    if (data?.document_type_code) {
      const { document_type_id, doc_type } = await resolveDocumentTypeByCode(
        supabase,
        data.document_type_code,
      );
      if (document_type_id) {
        q = q.eq("document_type_id" as never, document_type_id);
      } else {
        q = q.eq("doc_type" as never, doc_type);
      }
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return enrichDocumentListRows(supabase, (rows ?? []) as DocumentListRow[]);
  });

export const getDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [docRow, versions, sigs, comments, runs, events, tasks, contract, parties] =
      await Promise.all([
        fetchDocumentById(supabase, data.id),
        supabase
          .from("document_versions")
          .select("*")
          .eq("document_id", data.id)
          .order("version_no", { ascending: false }),
        supabase
          .from("document_signatures")
          .select("*")
          .eq("document_id", data.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("document_comments")
          .select("*")
          .eq("document_id", data.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("workflow_runs")
          .select("*, workflows(name_ru, name_kk, definition)")
          .eq("document_id", data.id)
          .order("started_at", { ascending: false }),
        supabase
          .from("workflow_events")
          .select("*")
          .eq("document_id", data.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("workflow_tasks")
          .select("*")
          .eq("document_id", data.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("contract_details")
          .select(
            "*, ref_correspondents!contract_details_counterparty_id_fkey(id, code, name_ru, name_kk, bin)",
          )
          .eq("document_id", data.id)
          .maybeSingle(),
        supabase
          .from("document_correspondents")
          .select("id, role, is_primary, ref_correspondents(id, code, name_ru, name_kk, bin)")
          .eq("document_id", data.id),
      ]);

    const { data: canViewContent } = await supabaseAdmin.rpc(
      "can_view_document_content" as never,
      { _doc_id: data.id, _user: context.userId } as never,
    );

    const document: Record<string, unknown> = {
      ...docRow,
      content_restricted: !canViewContent,
    };
    if (!canViewContent) {
      document.body = CONTENT_MASK;
      document.summary = CONTENT_MASK;
    }

    let can_manage_access_grants = false;
    try {
      await assertCanManageDocumentAccessGrants(supabase, context.userId, data.id);
      can_manage_access_grants = true;
    } catch {
      can_manage_access_grants = false;
    }

    return {
      document,
      versions: canViewContent ? (versions.data ?? []) : [],
      signatures: canViewContent ? (sigs.data ?? []) : [],
      comments: canViewContent ? (comments.data ?? []) : [],
      runs: runs.data ?? [],
      events: events.data ?? [],
      tasks: tasks.data ?? [],
      contract_details: contract.data ?? null,
      document_correspondents: parties.data ?? [],
      content_restricted: !canViewContent,
      can_manage_access_grants,
    } as never;
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [tasks, myDocs, allDocs, notifications] = await Promise.all([
      supabase
        .from("workflow_tasks")
        .select("id, status, due_at, title, document_id, created_at", { count: "exact" })
        .eq("assignee_id", userId)
        .eq("status", "pending")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(10),
      supabase
        .from("documents_full" as never)
        .select("id, reg_number, title_ru, title_kk, status, sla_status, created_at", {
          count: "exact",
        })
        .eq("created_by" as never, userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("documents_full" as never)
        .select("status, sla_status", { count: "exact", head: false }),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null),
    ]);
    const byStatus: Record<string, number> = {};
    let overdue = 0;
    for (const d of (allDocs.data ?? []) as { status: string; sla_status: string }[]) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      if (d.sla_status === "overdue") overdue += 1;
    }
    return {
      tasks: tasks.data ?? [],
      tasksCount: tasks.count ?? 0,
      myDocs: (myDocs.data ?? []) as Array<{
        id: string;
        reg_number: string;
        title_ru: string;
        title_kk: string | null;
        status: string;
        sla_status: string | null;
        created_at: string;
      }>,
      totalDocs: allDocs.count ?? 0,
      byStatus,
      overdue,
      unread: notifications.count ?? 0,
    };
  });

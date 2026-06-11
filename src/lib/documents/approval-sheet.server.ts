import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PROFILE_SELECT } from "@/lib/auth/server/constants";
import type { WorkflowDefinition, WorkflowNode } from "@/components/workflow-designer/types";
import { insertDocumentWithRegistration } from "@/lib/documents/create.server";
import {
  approvalNodeTypeLabel,
  buildApprovalSheetBody,
  buildApprovalSheetTitle,
  getNodeSheetLabel,
  type ApprovalSheetRow,
} from "@/lib/documents/approval-sheet-content";
import { orderActionableNodes, resolveWorkflowDefinition } from "@/lib/workflow/route-steps-view";

type ParentDocumentRow = {
  id: string;
  title_ru: string;
  title_kk: string | null;
  reg_number: string | null;
  created_at: string;
  workflow_id: string | null;
  custom_route: unknown;
  created_by: string | null;
};

function formatDocumentDate(iso: string): string {
  const date = iso.slice(0, 10);
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}.${m}.${y}`;
}

async function loadRouteDefinition(
  supabase: SupabaseClient,
  doc: ParentDocumentRow,
): Promise<WorkflowDefinition | null> {
  const fromCustom = resolveWorkflowDefinition({
    customRoute: doc.custom_route,
  });
  if (fromCustom?.nodes?.length) return fromCustom;

  if (!doc.workflow_id) return null;

  const { data, error } = await supabase
    .from("workflows")
    .select("definition")
    .eq("id", doc.workflow_id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const definition = data?.definition;
  if (
    definition &&
    typeof definition === "object" &&
    Array.isArray((definition as { nodes?: unknown }).nodes)
  ) {
    return definition as WorkflowDefinition;
  }

  return null;
}

async function resolveAssigneeUserIds(
  supabase: SupabaseClient,
  documentId: string,
  node: WorkflowNode,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("resolve_workflow_assignees" as never, {
    _node: node as never,
    _document: documentId,
  } as never);
  if (error) throw new Error(error.message);
  return ((data as string[] | null) ?? []).filter(Boolean);
}

type ProfileBrief = {
  id: string;
  full_name_ru: string | null;
  full_name_kk: string | null;
  position_ru: string | null;
  positions?: { title_ru?: string | null } | null;
};

function profileDisplayName(profile: ProfileBrief): string {
  return (profile.full_name_ru || profile.full_name_kk || "").trim() || "—";
}

function profilePosition(profile: ProfileBrief): string {
  return (
    profile.positions?.title_ru?.trim() ||
    profile.position_ru?.trim() ||
    ""
  );
}

async function loadProfiles(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileBrief>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .in("id", userIds);
  if (error) throw new Error(error.message);

  const map = new Map<string, ProfileBrief>();
  for (const row of (data ?? []) as ProfileBrief[]) {
    map.set(row.id, row);
  }
  return map;
}

export async function buildApprovalSheetRows(
  supabase: SupabaseClient,
  documentId: string,
  definition: WorkflowDefinition,
): Promise<ApprovalSheetRow[]> {
  const nodes = orderActionableNodes(definition);
  const rows: ApprovalSheetRow[] = [];

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const assigneeIds = await resolveAssigneeUserIds(supabase, documentId, node);
    const profiles = await loadProfiles(supabase, assigneeIds);

    const assigneeNames = assigneeIds
      .map((id) => profileDisplayName(profiles.get(id) ?? { id, full_name_ru: null, full_name_kk: null, position_ru: null }))
      .filter((name) => name !== "—");
    const assigneePositions = assigneeIds
      .map((id) => profilePosition(profiles.get(id) ?? { id, full_name_ru: null, full_name_kk: null, position_ru: null }))
      .filter(Boolean);

    rows.push({
      order: index + 1,
      stepLabel: getNodeSheetLabel(node),
      nodeType: approvalNodeTypeLabel(node.type),
      assigneeName: assigneeNames.length ? assigneeNames.join(", ") : "—",
      assigneePosition: assigneePositions.length ? assigneePositions.join(", ") : "—",
      decisionDate: "",
      signature: "",
      result: "",
    });
  }

  return rows;
}

async function resolveLinkTypeId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("ref_document_link_types")
    .select("id")
    .eq("code", "approval_sheet")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function resolveInternalDocumentTypeId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("ref_document_types")
    .select("id")
    .eq("code", "internal")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function hasExistingApprovalSheetLink(
  supabase: SupabaseClient,
  parentDocumentId: string,
): Promise<boolean> {
  const linkTypeId = await resolveLinkTypeId(supabase);
  if (!linkTypeId) return false;

  const { data, error } = await supabase
    .from("document_links")
    .select("id")
    .eq("source_document_id", parentDocumentId)
    .eq("link_type_id", linkTypeId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

function documentHasRoute(doc: ParentDocumentRow): boolean {
  if (doc.workflow_id) return true;
  if (!doc.custom_route) return false;
  if (Array.isArray(doc.custom_route)) return doc.custom_route.length > 0;
  if (typeof doc.custom_route === "object" && doc.custom_route !== null) {
    const nodes = (doc.custom_route as { nodes?: unknown }).nodes;
    return Array.isArray(nodes) && nodes.length > 0;
  }
  return false;
}

/**
 * Creates a linked «лист согласования» child document from the parent route definition.
 * Idempotent: skips if a link already exists or the document has no route.
 */
export async function attachApprovalSheetForDocument(options: {
  parentDocumentId: string;
  userId: string;
  supabase?: SupabaseClient;
}): Promise<{ sheetDocumentId: string } | null> {
  const supabase = options.supabase ?? supabaseAdmin;

  const { data: parent, error: parentErr } = await supabase
    .from("documents")
    .select("id, title_ru, title_kk, reg_number, created_at, workflow_id, custom_route, created_by")
    .eq("id", options.parentDocumentId)
    .single();
  if (parentErr || !parent) throw new Error(parentErr?.message ?? "Документ не найден");

  const doc = parent as ParentDocumentRow;
  if (!documentHasRoute(doc)) return null;
  if (await hasExistingApprovalSheetLink(supabase, doc.id)) return null;

  const definition = await loadRouteDefinition(supabase, doc);
  if (!definition?.nodes?.length) return null;

  const rows = await buildApprovalSheetRows(supabase, doc.id, definition);
  if (rows.length === 0) return null;

  const { data: orgRow } = await supabase
    .from("organization")
    .select("name_ru")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const body = buildApprovalSheetBody(
    {
      title: doc.title_ru,
      regNumber: doc.reg_number ?? "",
      documentDate: formatDocumentDate(doc.created_at),
      organizationName: orgRow?.name_ru?.trim() || undefined,
    },
    rows,
  );

  const documentTypeId = await resolveInternalDocumentTypeId(supabase);
  const child = await insertDocumentWithRegistration({
    title_ru: buildApprovalSheetTitle(doc.title_ru),
    title_kk: buildApprovalSheetTitle(doc.title_kk ?? doc.title_ru),
    body,
    document_type_id: documentTypeId,
    created_by: options.userId,
  });

  const linkTypeId = await resolveLinkTypeId(supabase);
  if (linkTypeId) {
    const { error: linkErr } = await supabase.from("document_links").insert({
      source_document_id: doc.id,
      target_document_id: child.id,
      link_type_id: linkTypeId,
      note: "Сформирован автоматически по маршруту согласования",
      created_by: options.userId,
    } as never);
    if (linkErr) throw new Error(linkErr.message);
  }

  return { sheetDocumentId: child.id };
}

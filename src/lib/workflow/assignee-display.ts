import type { WorkflowNode } from "@/components/workflow-designer/types";
import type { TFunction } from "@/i18n";

export interface AssigneeLookup {
  positions: Array<{ id: string; title_ru: string; title_kk: string }>;
  departments: Array<{ id: string; name_ru: string; name_kk: string; code?: string }>;
  users: Array<{
    id: string;
    full_name_ru: string;
    full_name_kk?: string | null;
    position_id?: string | null;
  }>;
  roles: Array<{ role: string; title_ru: string; title_kk?: string | null }>;
}

export function getNodeAssignee(node: WorkflowNode): { mode: string; ref: string | null } {
  const data = (node as { data?: Record<string, unknown> }).data;
  const mode = String(
    node.assignee_mode ||
      node.assignee_type ||
      data?.assignee_mode ||
      data?.assignee_type ||
      "",
  ).trim();
  const ref =
    (node.assignee_ref ??
      node.assignee_id ??
      data?.assignee_ref ??
      data?.assignee_id ??
      null) as string | null;
  return { mode: mode || "user", ref: ref || null };
}

function positionTitle(
  id: string | null,
  locale: string,
  lookup: AssigneeLookup,
): string | null {
  if (!id) return null;
  const pos = lookup.positions.find((p) => p.id === id);
  if (!pos) return null;
  return locale === "kk" && pos.title_kk ? pos.title_kk : pos.title_ru;
}

function departmentName(
  id: string | null,
  locale: string,
  lookup: AssigneeLookup,
): string | null {
  if (!id) return null;
  const dept = lookup.departments.find((d) => d.id === id);
  if (!dept) return null;
  return locale === "kk" && dept.name_kk ? dept.name_kk : dept.name_ru;
}

function userName(
  id: string | null,
  locale: string,
  lookup: AssigneeLookup,
): string | null {
  if (!id) return null;
  const user = lookup.users.find((u) => u.id === id);
  if (!user) return null;
  return locale === "kk" && user.full_name_kk ? user.full_name_kk : user.full_name_ru;
}

function roleTitle(
  code: string | null,
  locale: string,
  lookup: AssigneeLookup,
): string | null {
  if (!code) return null;
  const role = lookup.roles.find((r) => r.role === code);
  if (!role) return code;
  return locale === "kk" && role.title_kk ? role.title_kk : role.title_ru;
}

const ASSIGNEE_MODE_KEYS: Record<string, string> = {
  user: "wf.assignee.user",
  position: "wf.assignee.position",
  department: "wf.assignee.department",
  department_head: "wf.assignee.deptHead",
  parent_department_head: "wf.assignee.parentDeptHead",
  initiator_manager: "wf.assignee.initiatorManager",
  role: "wf.assignee.role",
  group: "wf.assignee.group",
};

export function resolveAssigneeLabel(options: {
  mode: string;
  ref: string | null;
  locale: string;
  lookup: AssigneeLookup;
  t: TFunction;
}): string {
  const { mode, ref, locale, lookup, t } = options;
  const modeKey = ASSIGNEE_MODE_KEYS[mode];
  const modeLabel = modeKey ? t(modeKey) : mode;

  switch (mode) {
    case "position": {
      const title = positionTitle(ref, locale, lookup);
      return title ?? modeLabel;
    }
    case "user": {
      const name = userName(ref, locale, lookup);
      if (!name) return modeLabel;
      const user = lookup.users.find((u) => u.id === ref);
      const posTitle = user?.position_id
        ? positionTitle(user.position_id, locale, lookup)
        : null;
      return posTitle ? `${name} — ${posTitle}` : name;
    }
    case "department": {
      const dept = departmentName(ref, locale, lookup);
      return dept ? `${modeLabel}: ${dept}` : modeLabel;
    }
    case "department_head":
    case "parent_department_head": {
      const dept = departmentName(ref, locale, lookup);
      return dept ? `${modeLabel}: ${dept}` : modeLabel;
    }
    case "role":
    case "group": {
      const title = roleTitle(ref, locale, lookup);
      return title ? `${modeLabel}: ${title}` : modeLabel;
    }
    case "initiator_manager":
      return modeLabel;
    default:
      return modeLabel;
  }
}

export function resolveNodeAssigneeLabel(
  node: WorkflowNode,
  locale: string,
  lookup: AssigneeLookup,
  t: TFunction,
): string {
  const { mode, ref } = getNodeAssignee(node);
  return resolveAssigneeLabel({ mode, ref, locale, lookup, t });
}

export function resolveTaskAssigneeLabel(
  assigneeId: string | null,
  locale: string,
  lookup: AssigneeLookup,
): string | null {
  if (!assigneeId) return null;
  const name = userName(assigneeId, locale, lookup);
  if (!name) return null;
  const user = lookup.users.find((u) => u.id === assigneeId);
  const posTitle = user?.position_id
    ? positionTitle(user.position_id, locale, lookup)
    : null;
  return posTitle ? `${name} (${posTitle})` : name;
}

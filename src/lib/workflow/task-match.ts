export interface WorkflowTaskRow {
  id: string;
  status: string;
  assignee_id?: string | null;
  role_code?: string | null;
  department_id?: string | null;
  title?: string;
  node_id?: string;
  node_type?: string;
  action_required?: string;
  due_at?: string | null;
}

export function findMyPendingTask(
  tasks: WorkflowTaskRow[],
  userId?: string,
  ctx?: { roleCodes?: string[]; deptId?: string | null; isAdmin?: boolean },
): WorkflowTaskRow | undefined {
  if (!userId || !tasks?.length) return undefined;

  const pending = tasks.filter((t) => t.status === "pending");
  const direct = pending.find((t) => t.assignee_id === userId);
  if (direct) return direct;

  if (ctx?.roleCodes?.length) {
    const roleTask = pending.find(
      (t) => !t.assignee_id && t.role_code && ctx.roleCodes!.includes(t.role_code),
    );
    if (roleTask) return roleTask;
  }

  if (ctx?.deptId) {
    const deptTask = pending.find(
      (t) => !t.assignee_id && t.department_id === ctx.deptId,
    );
    if (deptTask) return deptTask;
  }

  if (ctx?.isAdmin && pending.length > 0) return pending[0];

  return undefined;
}

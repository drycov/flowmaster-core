export interface WorkflowTaskRow {
  id: string;
  status: string;
  assignee_id?: string | null;
  title?: string;
  node_id?: string;
  node_type?: string;
  action_required?: string;
  due_at?: string | null;
}

export function findMyPendingTask(
  tasks: WorkflowTaskRow[],
  userId?: string,
  ctx?: { isAdmin?: boolean; substituteFor?: string[] },
): WorkflowTaskRow | undefined {
  if (!userId || !tasks?.length) return undefined;

  const pending = tasks.filter((t) => t.status === "pending");
  const principals = ctx?.substituteFor ?? [];

  const direct = pending.find(
    (t) =>
      t.assignee_id === userId ||
      (t.assignee_id != null && principals.includes(t.assignee_id)),
  );
  if (direct) return direct;

  if (ctx?.isAdmin && pending.length > 0) return pending[0];

  return undefined;
}

export function hasPendingSignTask(
  tasks: WorkflowTaskRow[],
  userId?: string,
): boolean {
  const task = findMyPendingTask(tasks, userId);
  if (!task) return false;
  return (
    task.action_required?.toLowerCase() === "sign" ||
    task.node_type?.toUpperCase() === "SIGNATURE"
  );
}

export type SignatureProvider = "ncalayer" | "egov_qr" | "any";

type WfNode = {
  id: string;
  data?: { config?: { signature_provider?: string } };
};

type WfRun = {
  id?: string;
  context?: { nodes?: WfNode[] } | null;
  workflows?: { definition?: { nodes?: WfNode[] } } | null;
};

type SignTask = {
  node_id?: string | null;
  run_id?: string | null;
};

export function resolveTaskSignatureProvider(
  task: SignTask | null | undefined,
  runs: WfRun[] | null | undefined,
): SignatureProvider {
  if (!task?.node_id) return "ncalayer";

  const run =
    runs?.find((r) => r.id === task.run_id) ??
    (runs?.length === 1 ? runs[0] : undefined);

  const wfDef = run?.workflows?.definition;
  const ctx = run?.context as { nodes?: WfNode[] } | null | undefined;
  const nodes = ctx?.nodes ?? wfDef?.nodes ?? [];
  const node = nodes.find((n) => n.id === task.node_id);
  const raw = node?.data?.config?.signature_provider ?? "ncalayer";

  if (raw === "egov_qr" || raw === "any") return raw;
  return "ncalayer";
}

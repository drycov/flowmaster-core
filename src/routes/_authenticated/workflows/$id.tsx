import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge, applyEdgeChanges, applyNodeChanges,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { getWorkflow, upsertWorkflow } from "@/lib/api/workflows.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/workflows/$id")({
  component: WorkflowDesigner,
});

const NODE_TYPES = ["START", "APPROVAL", "SIGNATURE", "TASK", "CONDITION", "NOTIFICATION", "TIMER", "ESCALATION", "ARCHIVE", "END"];

const nodeStyleByType: Record<string, React.CSSProperties> = {
  START: { background: "oklch(0.55 0.15 145)", color: "white" },
  END: { background: "oklch(0.35 0.06 250)", color: "white" },
  APPROVAL: { background: "oklch(0.93 0.06 250)", borderColor: "oklch(0.45 0.13 250)" },
  SIGNATURE: { background: "oklch(0.92 0.1 30)", borderColor: "oklch(0.55 0.21 27)" },
  TASK: { background: "white" },
  ARCHIVE: { background: "oklch(0.85 0.02 250)" },
  CONDITION: { background: "oklch(0.93 0.1 75)" },
};

function WorkflowDesigner() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: wf } = useQuery({ queryKey: ["wf", id], queryFn: () => getWorkflow({ data: { id } }) });

  const [nameRu, setNameRu] = useState("");
  const [nameKk, setNameKk] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    if (!wf) return;
    setNameRu(wf.name_ru);
    setNameKk(wf.name_kk);
    setStatus(wf.status as "draft" | "published" | "archived");
    const def = wf.definition as unknown as {
      nodes: Array<{ id: string; type: string; label?: string; position?: { x: number; y: number }; assignee_id?: string | null; sla_hours?: number }>;
      edges: Array<{ id: string; source: string; target: string; label?: string }>;
    };
    setNodes(
      (def?.nodes ?? []).map((n) => ({
        id: n.id,
        position: n.position ?? { x: 100, y: 100 },
        data: { label: `${n.type}\n${n.label ?? ""}`, _type: n.type, _label: n.label, _assignee: n.assignee_id, _sla: n.sla_hours },
        style: { ...nodeStyleByType[n.type], padding: 8, borderRadius: 4, fontSize: 11, whiteSpace: "pre-wrap", minWidth: 120, textAlign: "center" as const },
      })),
    );
    setEdges(
      (def?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        style: { strokeWidth: 1.5 },
      })),
    );
  }, [wf]);

  const onNodesChange = (chs: NodeChange[]) => setNodes((ns) => applyNodeChanges(chs, ns));
  const onEdgesChange = (chs: EdgeChange[]) => setEdges((es) => applyEdgeChanges(chs, es));
  const onConnect = (c: Connection) => setEdges((es) => addEdge({ ...c, id: `e_${Date.now()}` }, es));

  const addNode = (type: string) => {
    const id = `n_${Date.now()}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        position: { x: 250, y: 100 + ns.length * 70 },
        data: { label: type, _type: type, _label: type },
        style: { ...nodeStyleByType[type], padding: 8, borderRadius: 4, fontSize: 11, minWidth: 120, textAlign: "center" as const },
      },
    ]);
  };

  const save = useMutation({
    mutationFn: () =>
      upsertWorkflow({
        data: {
          id,
          name_ru: nameRu,
          name_kk: nameKk,
          status,
          definition: {
            nodes: nodes.map((n) => ({
              id: n.id,
              type: (n.data as { _type: string })._type,
              label: (n.data as { _label?: string })._label,
              position: n.position,
              assignee_id: (n.data as { _assignee?: string | null })._assignee ?? null,
              sla_hours: (n.data as { _sla?: number })._sla,
            })),
            edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === "string" ? e.label : undefined })),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["wf", id] });
      qc.invalidateQueries({ queryKey: ["wfs"] });
    },
  });

  return (
    <>
      <PageHeader
        title={t("wf.designer")}
        actions={
          <>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("wf.draft")}</SelectItem>
                <SelectItem value="published">{t("wf.published")}</SelectItem>
                <SelectItem value="archived">{t("status.archived")}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
          </>
        }
      />
      <PageBody className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-9rem)]">
        <div className="space-y-3 overflow-y-auto pr-2">
          <div>
            <Label>{t("common.name")} (RU)</Label>
            <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
          </div>
          <div>
            <Label>{t("common.name")} (KK)</Label>
            <Input value={nameKk} onChange={(e) => setNameKk(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">{t("wf.add_node")}</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {NODE_TYPES.map((tp) => (
                <Button key={tp} size="sm" variant="outline" className="text-[11px] justify-start" onClick={() => addNode(tp)}>
                  <Plus className="w-3 h-3 mr-1" />{tp}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Перетаскивайте узлы, соединяйте от точки к точке. Сохранение фиксирует версию маршрута.
          </p>
        </div>
        <div className="border border-border rounded-sm bg-white">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </PageBody>
    </>
  );
}

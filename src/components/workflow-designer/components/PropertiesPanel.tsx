import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MousePointerClick, Route } from "lucide-react";
import { useI18n } from "@/i18n";
import { NodePropertiesForm } from "./NodePropertiesForm";
import { EdgePropertiesForm } from "./EdgePropertiesForm";
import type { FlowNode, FlowEdge, User, Role, Department, WorkflowStatus } from "../types";
import type { DocumentField } from "../types";

interface PropertiesPanelProps {
  nameRu: string;
  nameKk: string;
  description: string;
  status: WorkflowStatus;
  version: number;
  nodesCount: number;
  edgesCount: number;
  validationErrors: string[];
  selectedNode: FlowNode | null;
  selectedEdge: FlowEdge | null;
  nodes: FlowNode[];
  users?: User[];
  roles?: Role[];
  departments?: Department[];
  documentFields?: DocumentField[];
  onNameRuChange: (value: string) => void;
  onNameKkChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onUpdateNode: (updates: Partial<FlowNode["data"]>) => void;
  onUpdateEdge: (updates: { label?: string; condition?: string }) => void;
  onDeleteNode: () => void;
  onDeleteEdge: () => void;
}

export function PropertiesPanel({
  nameRu,
  nameKk,
  description,
  status,
  version,
  nodesCount,
  edgesCount,
  validationErrors,
  selectedNode,
  selectedEdge,
  nodes,
  users,
  roles,
  departments,
  documentFields,
  onNameRuChange,
  onNameKkChange,
  onDescriptionChange,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
}: PropertiesPanelProps) {
  const { t } = useI18n();

  const panelTitle = selectedNode
    ? t("wf.properties.node")
    : selectedEdge
      ? t("wf.properties.edge")
      : t("wf.properties.workflow");

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{panelTitle}</h2>
        {!selectedNode && !selectedEdge && (
          <Badge variant={status === "published" ? "default" : "secondary"} className="text-[10px]">
            v{version}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {validationErrors.length > 0 && (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                {t("wf.validationErrors")}
              </div>
              <ul className="space-y-1 text-xs text-destructive/90">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedNode ? (
            <NodePropertiesForm
              node={selectedNode}
              users={users}
              roles={roles}
              departments={departments}
              onUpdate={onUpdateNode}
              onDelete={onDeleteNode}
            />
          ) : selectedEdge ? (
            <EdgePropertiesForm
              edge={selectedEdge}
              sourceNode={nodes.find((n) => n.id === selectedEdge.source)}
              targetNode={nodes.find((n) => n.id === selectedEdge.target)}
              documentFields={documentFields}
              onUpdate={onUpdateEdge}
              onDelete={onDeleteEdge}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t("wf.properties.selectHint")}</p>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Route className="h-4 w-4 text-muted-foreground" />
                  {t("wf.properties.routeSettings")}
                </div>
                <div className="space-y-2">
                  <Label>{t("wf.nameRu")}</Label>
                  <Input value={nameRu} onChange={(e) => onNameRuChange(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("wf.nameKk")}</Label>
                  <Input value={nameKk} onChange={(e) => onNameKkChange(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.description")}</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    rows={3}
                    placeholder={t("wf.description")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="text-lg font-semibold">{nodesCount}</div>
                  <div className="text-muted-foreground">{t("wf.nodesCount")}</div>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="text-lg font-semibold">{edgesCount}</div>
                  <div className="text-muted-foreground">{t("wf.edgesCount")}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useI18n, workflowNodeLabel } from "@/i18n";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertWorkflow } from "@/lib/api/workflows.functions";
import { listUsersBrief, listDepartmentsBrief, listRolesBrief } from "@/lib/api/admin.functions";
import { useWorkflowData } from "@/components/workflow-designer/hooks/useWorkflowData";
import { useFlowState } from "@/components/workflow-designer/hooks/useFlowState";
import { useWorkflowValidation } from "@/components/workflow-designer/hooks/useWorkflowValidation";
import { NodePalette } from "@/components/workflow-designer/components/NodePalette";
import { FlowCanvas } from "@/components/workflow-designer/components/FlowCanvas";
import { PropertiesPanel } from "@/components/workflow-designer/components/PropertiesPanel";
import { DeleteConfirmDialog } from "@/components/workflow-designer/components/DeleteConfirmDialog";
import { WorkflowDesignerProvider } from "@/components/workflow-designer/context/WorkflowDesignerContext";
import { EDMS_DOCUMENT_FIELDS } from "@/lib/workflow/document-fields";
import type { NodeType } from "@/components/workflow-designer/types";

export const Route = createFileRoute("/_authenticated/workflows/$id")({
  beforeLoad: () => requireModule("workflows"),
  component: WorkflowDesignerPage,
});

function WorkflowDesignerPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();

  const {
    nameRu,
    nameKk,
    description,
    status,
    definition,
    version,
    isLoading,
    setNameRu,
    setNameKk,
    setDescription,
    setStatus,
  } = useWorkflowData(id);

  const {
    nodes,
    edges,
    selectedNode,
    selectedEdge,
    setSelectedNode,
    setSelectedEdge,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNodeAtPosition,
    deleteNode,
    deleteEdge,
    updateNodeData,
    updateEdgeData,
    loadDefinition,
    getDefinition,
  } = useFlowState({ t });

  const { validationErrors, validate, clearErrors } = useWorkflowValidation(t);

  const { data: usersRaw } = useQuery({
    queryKey: ["wf-users"],
    queryFn: () => listUsersBrief(),
  });

  const { data: rolesRaw } = useQuery({
    queryKey: ["wf-roles"],
    queryFn: () => listRolesBrief(),
  });

  const { data: departmentsRaw } = useQuery({
    queryKey: ["wf-departments"],
    queryFn: () => listDepartmentsBrief(),
  });

  const users = useMemo(
    () =>
      (usersRaw ?? []).map((u: any) => ({
        id: u.id,
        name: u.full_name_ru || u.email || u.id,
        email: u.email ?? "",
        role: "",
      })),
    [usersRaw],
  );

  const roles = useMemo(
    () => (rolesRaw ?? []).map((r: any) => ({ id: r.role, name: r.title_ru || r.role })),
    [rolesRaw],
  );

  const departments = useMemo(
    () =>
      (departmentsRaw ?? []).map((d: any) => ({
        id: d.id,
        name: d.name_ru || d.code,
      })),
    [departmentsRaw],
  );

  const designerLookup = useMemo(
    () => ({
      users: (usersRaw ?? []).map((u: any) => ({
        id: u.id,
        full_name_ru: u.full_name_ru || u.email || u.id,
        full_name_kk: u.full_name_kk,
        position_id: u.position_id ?? null,
      })),
      departments: (departmentsRaw ?? []).map((d: any) => ({
        id: d.id,
        name_ru: d.name_ru || d.code,
        name_kk: d.name_kk,
        code: d.code,
      })),
      roles: (rolesRaw ?? []).map((r: any) => ({
        role: r.role,
        title_ru: r.title_ru || r.role,
        title_kk: r.title_kk,
      })),
      positions: [],
    }),
    [usersRaw, departmentsRaw, rolesRaw],
  );

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (definition) {
      loadDefinition(definition);
    }
  }, [definition, loadDefinition]);

  const handleNodeClick = (_event: React.MouseEvent, node: any) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleEdgeClick = (_event: React.MouseEvent, edge: any) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const handlePaneClick = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const handleDeleteNodeConfirm = () => {
    if (selectedNode) {
      deleteNode(selectedNode.id);
      setSelectedNode(null);
      setDeleteConfirmOpen(false);
      toast.success(t("wf.nodeDeleted"));
    }
  };

  const handleDeleteEdge = () => {
    if (selectedEdge) {
      deleteEdge(selectedEdge.id);
      setSelectedEdge(null);
      toast.success(t("wf.deleteEdge"));
    }
  };

  const handleSave = async (opts?: { publish?: boolean }) => {
    const isValid = validate(nodes, edges);
    if (!isValid) {
      toast.error(t("wf.validationErrors"));
      return;
    }

    setIsSaving(true);
    try {
      const nextDefinition = getDefinition();
      const nextStatus = opts?.publish ? "published" : status;

      await upsertWorkflow({
        data: {
          id,
          name_ru: nameRu,
          name_kk: nameKk,
          description,
          status: nextStatus,
          definition: nextDefinition,
          bump_version: !!opts?.publish,
        },
      });

      if (opts?.publish) setStatus("published");
      toast.success(t("wf.saved"));
      qc.invalidateQueries({ queryKey: ["wf", id] });
      qc.invalidateQueries({ queryKey: ["wfs"] });
      clearErrors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("wf.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNode = (type: NodeType) => {
    addNodeAtPosition(type, { x: 280, y: 120 + nodes.length * 100 });
    toast.success(workflowNodeLabel(t, type));
  };

  const handleUpdateNode = (updates: any) => {
    if (selectedNode) {
      updateNodeData(selectedNode.id, updates);
      setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, ...updates } } : null));
    }
  };

  const handleUpdateEdge = (updates: { label?: string; condition?: string }) => {
    if (selectedEdge) {
      updateEdgeData(selectedEdge.id, updates);
      setSelectedEdge((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center">{t("common.loading")}</div>;
  }

  return (
    <WorkflowDesignerProvider lookup={designerLookup}>
      <PageHeader
        title={nameRu || t("wf.designer")}
        description={description || undefined}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("wf.status.draft")}</SelectItem>
                <SelectItem value="published">{t("wf.status.published")}</SelectItem>
                <SelectItem value="archived">{t("status.archived")}</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="hidden sm:inline-flex">
              v{version}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => handleSave()} disabled={isSaving}>
              {isSaving ? t("wf.saving") : t("common.save")}
            </Button>
            <Button size="sm" onClick={() => handleSave({ publish: true })} disabled={isSaving}>
              {t("wf.publish")}
            </Button>
          </div>
        }
      />

      <PageBody className="flex h-[calc(100dvh-9.5rem)] min-h-[520px] flex-col p-4">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm">
          <NodePalette onAddNode={handleAddNode} />

          <div className="flex min-w-0 flex-1 flex-col">
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={handlePaneClick}
              onDropNode={addNodeAtPosition}
            />
          </div>

          <PropertiesPanel
            nameRu={nameRu}
            nameKk={nameKk}
            description={description}
            status={status}
            version={version}
            nodesCount={nodes.length}
            edgesCount={edges.length}
            validationErrors={validationErrors}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            nodes={nodes}
            users={users}
            roles={roles}
            departments={departments}
            documentFields={EDMS_DOCUMENT_FIELDS}
            onNameRuChange={setNameRu}
            onNameKkChange={setNameKk}
            onDescriptionChange={setDescription}
            onUpdateNode={handleUpdateNode}
            onUpdateEdge={handleUpdateEdge}
            onDeleteNode={() => setDeleteConfirmOpen(true)}
            onDeleteEdge={handleDeleteEdge}
          />
        </div>
      </PageBody>

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        node={selectedNode}
        connectedEdgesCount={
          selectedNode
            ? edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                .length
            : 0
        }
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteNodeConfirm}
      />
    </WorkflowDesignerProvider>
  );
}

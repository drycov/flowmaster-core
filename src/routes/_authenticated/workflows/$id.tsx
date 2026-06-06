import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertWorkflow } from "@/lib/api/workflows.functions";
import {
  listUsersBrief,
  listDepartmentsBrief,
  listRolesBrief,
} from "@/lib/api/admin.functions";

import { useEffect, useState } from "react";
import { useWorkflowData } from "@/components/workflow-designer/hooks/useWorkflowData";
import { useFlowState } from "@/components/workflow-designer/hooks/useFlowState";
import { useWorkflowValidation } from "@/components/workflow-designer/hooks/useWorkflowValidation";
import { LeftPanel } from "@/components/workflow-designer/components/LeftPanel";
import { FlowCanvas } from "@/components/workflow-designer/components/FlowCanvas";
import { NodeEditSheet } from "@/components/workflow-designer/components/NodeEditSheet";
import { EdgeEditSheet } from "@/components/workflow-designer/components/EdgeEditSheet";
import { DeleteConfirmDialog } from "@/components/workflow-designer/components/DeleteConfirmDialog";

export const Route = createFileRoute("/_authenticated/workflows/$id")({
  component: WorkflowDesigner,
});

export function WorkflowDesigner() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();

  // Данные workflow
  const {
    nameRu,
    nameKk,
    description,
    status,
    definition,
    isLoading,
    setNameRu,
    setNameKk,
    setDescription,
    setStatus,
  } = useWorkflowData(id);

  // Состояние графа
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
    addNode,
    deleteNode,
    deleteEdge,
    updateNodeData,
    updateEdgeData,
    loadDefinition,
    getDefinition,
  } = useFlowState();

  // Валидация
  const { validationErrors, validate, clearErrors } = useWorkflowValidation();

  // Справочники
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiService.getUsers(),
    enabled: false,
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiService.getRoles(),
    enabled: false,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiService.getDepartments(),
    enabled: false,
  });

  const { data: documentFields } = useQuery({
    queryKey: ["documentFields"],
    queryFn: () => apiService.getDocumentFields(),
    enabled: false,
  });

  // Состояния UI
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Загрузка определения
  useEffect(() => {
    if (definition) {
      loadDefinition(definition);
    }
  }, [definition, loadDefinition]);

  // Обработчики
  const handleNodeClick = (event: React.MouseEvent, node: any) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setSheetOpen(true);
  };

  const handleEdgeClick = (event: React.MouseEvent, edge: any) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const handleDeleteNodeConfirm = () => {
    if (selectedNode) {
      deleteNode(selectedNode.id);
      setSheetOpen(false);
      setSelectedNode(null);
      setDeleteConfirmOpen(false);
      toast.success(`Узел удален`);
    }
  };

  const handleDeleteEdge = () => {
    if (selectedEdge) {
      deleteEdge(selectedEdge.id);
      setSheetOpen(false);
      setSelectedEdge(null);
      toast.success("Связь удалена");
    }
  };

  const handleSave = async () => {
    const isValid = validate(nodes, edges);
    if (!isValid) {
      toast.error("Пожалуйста, исправьте ошибки перед сохранением");
      return;
    }

    setIsSaving(true);

    try {
      const definition = getDefinition();
      await upsertWorkflow({
        data: {
          id,
          name_ru: nameRu,
          name_kk: nameKk,
          description,
          status,
          definition,
        },
      });

      toast.success("Workflow успешно сохранен");
      qc.invalidateQueries({ queryKey: ["wf", id] });
      qc.invalidateQueries({ queryKey: ["wfs"] });
      clearErrors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNode = (type: string) => {
    addNode(type as any);
    toast.success(`Добавлен узел: ${type}`);
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
    return <div className="flex items-center justify-center h-full">Загрузка...</div>;
  }

  return (
    <>
      <PageHeader
        title={t("wf.designer")}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Черновик</SelectItem>
                <SelectItem value="published">Опубликован</SelectItem>
                <SelectItem value="archived">Архивирован</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        }
      />

      <PageBody className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-9rem)]">
        <LeftPanel
          nameRu={nameRu}
          nameKk={nameKk}
          description={description}
          status={status}
          validationErrors={validationErrors}
          nodesCount={nodes.length}
          edgesCount={edges.length}
          onNameRuChange={setNameRu}
          onNameKkChange={setNameKk}
          onDescriptionChange={setDescription}
          onStatusChange={setStatus}
          onAddNode={handleAddNode}
        />

        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
        />
      </PageBody>

      <NodeEditSheet
        open={sheetOpen && !!selectedNode}
        node={selectedNode}
        users={users}
        roles={roles}
        departments={departments}
        onClose={handleCloseSheet}
        onUpdate={handleUpdateNode}
        onDelete={() => setDeleteConfirmOpen(true)}
        onDeleteConfirm={() => setDeleteConfirmOpen(true)}
      />

      <EdgeEditSheet
        open={sheetOpen && !!selectedEdge}
        edge={selectedEdge}
        sourceNode={selectedEdge ? nodes.find((n) => n.id === selectedEdge.source) : undefined}
        targetNode={selectedEdge ? nodes.find((n) => n.id === selectedEdge.target) : undefined}
        documentFields={documentFields}
        onClose={handleCloseSheet}
        onUpdate={handleUpdateEdge}
        onDelete={handleDeleteEdge}
      />

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        node={selectedNode}
        connectedEdgesCount={selectedNode ? edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length : 0}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteNodeConfirm}
      />
    </>
  );
}
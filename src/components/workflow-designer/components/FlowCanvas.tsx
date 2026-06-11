import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useI18n } from "@/i18n";
import type { FlowNode, FlowEdge, NodeType } from "../types";
import { WorkflowCanvasNode } from "./WorkflowCanvasNode";

interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: FlowNode) => void;
  onEdgeClick: (event: React.MouseEvent, edge: FlowEdge) => void;
  onPaneClick?: () => void;
  onDropNode?: (type: NodeType, position: { x: number; y: number }) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onDropNode,
}: FlowCanvasProps) {
  const { t } = useI18n();
  const nodeTypes = useMemo(() => ({ workflowNode: WorkflowCanvasNode }), []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/workflow-node-type") as NodeType;
      if (!type || !onDropNode) return;
      const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onDropNode(type, {
        x: e.clientX - bounds.left - 90,
        y: e.clientY - bounds.top - 28,
      });
    },
    [onDropNode],
  );

  return (
    <div className="relative min-h-0 flex-1 bg-slate-50/80" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes as any}
        edges={edges as any}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange as any}
        onEdgesChange={onEdgesChange as any}
        onConnect={onConnect}
        onNodeClick={onNodeClick as any}
        onEdgeClick={onEdgeClick as any}
        onPaneClick={onPaneClick}
        nodesDraggable
        nodesConnectable
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.35}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        proOptions={{ hideAttribution: true }}
        className="h-full"
      >
        <Background gap={20} color="#cbd5e1" />
        <Controls showInteractive={false} className="!shadow-md" />
        <MiniMap
          pannable
          zoomable
          className="!shadow-md"
          nodeColor={(node) => {
            const type = (node.data as { type?: string })?.type;
            if (type === "START") return "#10b981";
            if (type === "END") return "#ef4444";
            if (type === "SIGNATURE") return "#f97316";
            if (type === "APPROVAL") return "#3b82f6";
            return "#94a3b8";
          }}
        />
        <Panel position="top-center" className="pointer-events-none m-2">
          <div className="rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {t("wf.canvasHint")}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

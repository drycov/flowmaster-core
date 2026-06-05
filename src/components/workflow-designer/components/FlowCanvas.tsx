import { ReactFlow, Background, Controls, MiniMap, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowNode, FlowEdge } from "../types";

interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: FlowNode) => void;
  onEdgeClick: (event: React.MouseEvent, edge: FlowEdge) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
}: FlowCanvasProps) {
  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden relative">
      <ReactFlow
        nodes={nodes as any}
        edges={edges as any}
        onNodesChange={onNodesChange as any}
        onEdgesChange={onEdgesChange as any}
        onConnect={onConnect}
        onNodeClick={onNodeClick as any}
        onEdgeClick={onEdgeClick as any}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="#94a3b8" />
      </ReactFlow>
    </div>
  );
}
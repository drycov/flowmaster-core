import { useState, useCallback } from "react";

import { applyNodeChanges, applyEdgeChanges, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react";

import { createNewNode, createNewEdge, toFlowNode, toFlowEdge, toDomainNode, toDomainEdge } from "../utils/mappers";

import type { FlowNode, FlowEdge, WorkflowDefinition, NodeType } from "../types";

import type { TFunction } from "@/i18n";



interface UseFlowStateOptions {

  t?: TFunction;

}



interface UseFlowStateReturn {

  nodes: FlowNode[];

  edges: FlowEdge[];

  selectedNode: FlowNode | null;

  selectedEdge: FlowEdge | null;

  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;

  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;

  setSelectedNode: React.Dispatch<React.SetStateAction<FlowNode | null>>;

  setSelectedEdge: React.Dispatch<React.SetStateAction<FlowEdge | null>>;

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;

  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;

  onConnect: (connection: Connection) => void;

  addNode: (type: NodeType) => void;

  addNodeAtPosition: (type: NodeType, position: { x: number; y: number }) => void;

  deleteNode: (nodeId: string) => { deletedEdgesCount: number };

  deleteEdge: (edgeId: string) => void;

  updateNodeData: (nodeId: string, updates: Partial<FlowNode["data"]>) => void;

  updateEdgeData: (edgeId: string, updates: { label?: string; condition?: string }) => void;

  loadDefinition: (definition: WorkflowDefinition) => void;

  getDefinition: () => WorkflowDefinition;

}



export function useFlowState(options?: UseFlowStateOptions): UseFlowStateReturn {

  const t = options?.t;

  const [nodes, setNodes] = useState<FlowNode[]>([]);

  const [edges, setEdges] = useState<FlowEdge[]>([]);

  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);

  const [selectedEdge, setSelectedEdge] = useState<FlowEdge | null>(null);



  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {

    setNodes((prev) => applyNodeChanges(changes, prev));

  }, []);



  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {

    setEdges((prev) => applyEdgeChanges(changes, prev));

  }, []);



  const onConnect = useCallback((connection: Connection) => {

    if (connection.source && connection.target) {

      setEdges((prev) => [...prev, createNewEdge(connection as { source: string; target: string })]);

    }

  }, []);



  const addNode = useCallback(

    (type: NodeType) => {

      const center = { x: 250, y: 100 + nodes.length * 80 };

      setNodes((prev) => [...prev, createNewNode(type, center, t)]);

    },

    [nodes.length, t],

  );



  const addNodeAtPosition = useCallback(

    (type: NodeType, position: { x: number; y: number }) => {

      setNodes((prev) => [...prev, createNewNode(type, position, t)]);

    },

    [t],

  );



  const deleteNode = useCallback((nodeId: string) => {

    const connectedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId);

    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));

    setNodes((prev) => prev.filter((n) => n.id !== nodeId));

    return { deletedEdgesCount: connectedEdges.length };

  }, [edges]);



  const deleteEdge = useCallback((edgeId: string) => {

    setEdges((prev) => prev.filter((e) => e.id !== edgeId));

  }, []);



  const updateNodeData = useCallback((nodeId: string, updates: Partial<FlowNode["data"]>) => {

    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n)));

  }, []);



  const updateEdgeData = useCallback((edgeId: string, updates: { label?: string; condition?: string }) => {

    setEdges((prev) =>

      prev.map((e) =>

        e.id === edgeId ? { ...e, ...updates, data: { ...e.data, ...updates } } : e

      )

    );

  }, []);



  const loadDefinition = useCallback(

    (definition: WorkflowDefinition) => {

      setNodes((definition.nodes ?? []).map((n) => toFlowNode(n, t)));

      setEdges((definition.edges ?? []).map(toFlowEdge));

    },

    [t],

  );



  const getDefinition = useCallback((): WorkflowDefinition => ({

    nodes: nodes.map(toDomainNode),

    edges: edges.map(toDomainEdge),

  }), [nodes, edges]);



  return {

    nodes,

    edges,

    selectedNode,

    selectedEdge,

    setNodes,

    setEdges,

    setSelectedNode,

    setSelectedEdge,

    onNodesChange,

    onEdgesChange,

    onConnect,

    addNode,

    addNodeAtPosition,

    deleteNode,

    deleteEdge,

    updateNodeData,

    updateEdgeData,

    loadDefinition,

    getDefinition,

  };

}


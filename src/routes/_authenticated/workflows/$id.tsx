import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { getWorkflow, upsertWorkflow } from "@/lib/api/workflows.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, Code2, MousePointerSquareDashed } from "lucide-react";

// Типы для API
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id?: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface DocumentField {
  id: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

// API сервисы (заглушки - замените на реальные вызовы)
const apiService = {
  getUsers: async (): Promise<User[]> => {
    // TODO: заменить на реальный API вызов
    throw new Error("API not implemented");
  },
  getRoles: async (): Promise<Role[]> => {
    // TODO: заменить на реальный API вызов
    throw new Error("API not implemented");
  },
  getDepartments: async (): Promise<Department[]> => {
    // TODO: заменить на реальный API вызов
    throw new Error("API not implemented");
  },
  getDocumentFields: async (documentType: string): Promise<DocumentField[]> => {
    // TODO: заменить на реальный API вызов
    throw new Error("API not implemented");
  },
};

// Компонент Combobox с поддержкой поиска
interface ComboboxOption {
  value: string;
  label: string;
  metadata?: unknown;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

function Combobox({ options, value, onChange, placeholder, disabled, isLoading }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="w-full border rounded-md px-3 py-2 text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {isLoading ? "Загрузка..." : (selectedOption ? selectedOption.label : placeholder)}
      </button>
      
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg">
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-2 border-b text-sm outline-none focus:ring-0"
              autoFocus
            />
            <div className="max-h-60 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="p-2 text-sm text-gray-500 text-center">Ничего не найдено</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:outline-none text-sm"
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ===================== DOMAIN ===================== */

type NodeType =
  | "START"
  | "APPROVAL"
  | "SIGNATURE"
  | "TASK"
  | "CONDITION"
  | "NOTIFICATION"
  | "TIMER"
  | "ESCALATION"
  | "ARCHIVE"
  | "END";

type AssigneeType = "user" | "role" | "department";

type WorkflowNode = {
  id: string;
  type: NodeType;
  label?: string;
  description?: string;
  position: { x: number; y: number };
  assignee_id?: string | null;
  assignee_type?: AssigneeType;
  sla_hours?: number;
  sla_unit?: "hours" | "business_days";
  sla_working_hours_only?: boolean;
  config?: Record<string, unknown>;
};

type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
};

type WorkflowDefinition = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

/* ===================== UI TYPES ===================== */

type WorkflowNodeData = {
  type: NodeType;
  label?: string;
  description?: string;
  assignee_id?: string | null;
  assignee_type?: AssigneeType;
  sla_hours?: number | null;
  sla_unit?: "hours" | "business_days";
  sla_working_hours_only?: boolean;
  config?: Record<string, unknown>;
};

type FlowNode = Node<WorkflowNodeData>;
type FlowEdge = Edge<{ condition?: string }>;

/* ===================== CONSTANTS ===================== */

const NODE_TYPES: NodeType[] = [
  "START", "APPROVAL", "SIGNATURE", "TASK", "CONDITION",
  "NOTIFICATION", "TIMER", "ESCALATION", "ARCHIVE", "END",
];

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  START: "Старт",
  APPROVAL: "Согласование",
  SIGNATURE: "Подписание",
  TASK: "Задача",
  CONDITION: "Условие",
  NOTIFICATION: "Уведомление",
  TIMER: "Таймер",
  ESCALATION: "Эскалация",
  ARCHIVE: "Архивация",
  END: "Завершение",
};

const NODE_TYPE_ICONS: Partial<Record<NodeType, string>> = {
  START: "🚀",
  APPROVAL: "✓",
  SIGNATURE: "✍️",
  TASK: "📋",
  CONDITION: "🔀",
  NOTIFICATION: "🔔",
  TIMER: "⏱️",
  ESCALATION: "⚠️",
  ARCHIVE: "📦",
  END: "🏁",
};

const nodeStyleByType: Partial<Record<NodeType, React.CSSProperties>> = {
  START: { background: "#10b981", color: "white", border: "2px solid #059669" },
  END: { background: "#ef4444", color: "white", border: "2px solid #dc2626" },
  APPROVAL: { background: "#eff6ff", borderColor: "#3b82f6", border: "2px solid #3b82f6" },
  SIGNATURE: { background: "#fff7ed", borderColor: "#f97316", border: "2px solid #f97316" },
  TASK: { background: "#f8fafc", border: "2px solid #64748b" },
  ARCHIVE: { background: "#f3f4f6", border: "2px solid #6b7280" },
  CONDITION: { background: "#fefce8", borderColor: "#eab308", border: "2px solid #eab308" },
  NOTIFICATION: { background: "#fef2f2", borderColor: "#ef4444", border: "2px solid #ef4444" },
  TIMER: { background: "#ecfdf5", borderColor: "#10b981", border: "2px solid #10b981" },
  ESCALATION: { background: "#fef3c7", borderColor: "#d97706", border: "2px solid #d97706" },
};

const OPERATORS = [
  { id: "===", label: "Равно" },
  { id: "!==", label: "Не равно" },
  { id: ">", label: "Больше" },
  { id: "<", label: "Меньше" },
  { id: ">=", label: "Больше или равно" },
  { id: "<=", label: "Меньше или равно" },
  { id: "includes", label: "Содержит" },
  { id: "startsWith", label: "Начинается с" },
  { id: "endsWith", label: "Заканчивается на" },
];

/* ===================== MAPPERS ===================== */

const toFlowNode = (n: WorkflowNode): FlowNode => ({
  id: n.id,
  type: "default",
  position: n.position,
  data: {
    type: n.type,
    label: n.label || NODE_TYPE_LABELS[n.type],
    description: n.description,
    assignee_id: n.assignee_id,
    assignee_type: n.assignee_type || "user",
    sla_hours: n.sla_hours ?? null,
    sla_unit: n.sla_unit || "hours",
    sla_working_hours_only: n.sla_working_hours_only || false,
    config: n.config,
  },
  style: {
    ...nodeStyleByType[n.type],
    padding: "12px 8px",
    borderRadius: 8,
    fontSize: 12,
    whiteSpace: "pre-wrap",
    minWidth: 140,
    textAlign: "center",
    fontWeight: 500,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    cursor: "pointer",
  },
});

const toFlowEdge = (e: WorkflowEdge): FlowEdge => ({
  id: e.id,
  type: "default",
  source: e.source,
  target: e.target,
  label: e.label,
  data: { condition: e.condition },
  style: { strokeWidth: 2, stroke: "#64748b" },
  labelStyle: { fill: "#1e293b", fontSize: 12, fontWeight: 600 },
  labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9, stroke: "#cbd5e1" },
  labelBgPadding: [8, 4],
  labelBgBorderRadius: 4,
});

const toDomainNode = (n: FlowNode): WorkflowNode => ({
  id: n.id,
  type: n.data.type,
  label: n.data.label,
  description: n.data.description,
  position: n.position,
  assignee_id: n.data.assignee_id ?? null,
  assignee_type: n.data.assignee_type,
  sla_hours: n.data.sla_hours ?? undefined,
  sla_unit: n.data.sla_unit,
  sla_working_hours_only: n.data.sla_working_hours_only,
  config: n.data.config,
});

const toDomainEdge = (e: FlowEdge): WorkflowEdge => ({
  id: e.id,
  source: e.source,
  target: e.target,
  label: typeof e.label === "string" ? e.label : undefined,
  condition: e.data?.condition,
});

/* ===================== ROUTE ===================== */

export const Route = createFileRoute("/_authenticated/workflows/$id")({
  component: WorkflowDesigner,
});

/* ===================== COMPONENT ===================== */

function WorkflowDesigner() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();

  // Загрузка данных workflow
  const { data: wf } = useQuery({
    queryKey: ["wf", id],
    queryFn: () => getWorkflow({ data: { id } }),
  });

  // Загрузка справочников
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiService.getUsers().catch(() => []),
    enabled: false, // Включаем когда API готов
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiService.getRoles().catch(() => []),
    enabled: false,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiService.getDepartments().catch(() => []),
    enabled: false,
  });

  const { data: documentFields } = useQuery({
    queryKey: ["documentFields"],
    queryFn: () => apiService.getDocumentFields("default").catch(() => []),
    enabled: false,
  });

  const [nameRu, setNameRu] = useState("");
  const [nameKk, setNameKk] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");

  /* UI STATE */
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<FlowEdge | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isRawCondition, setIsRawCondition] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /* ===================== LOAD ===================== */

  useEffect(() => {
    if (!wf) return;

    setNameRu(wf.name_ru);
    setNameKk(wf.name_kk);
    setDescription(wf.description || "");
    setStatus(wf.status as any);

    const def = wf.definition as WorkflowDefinition;
    setNodes((def.nodes ?? []).map(toFlowNode));
    setEdges((def.edges ?? []).map(toFlowEdge));
  }, [wf]);

  /* ===================== FLOW HANDLERS ===================== */

  const onNodesChange = (changes: NodeChange<FlowNode>[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev) as FlowNode[]);
  };

  const onEdgesChange = (changes: EdgeChange<FlowEdge>[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev) as FlowEdge[]);
  };

  const onConnect = (c: Connection) => {
    const newEdge: FlowEdge = {
      ...c,
      id: `edge_${Date.now()}_${Math.random()}`,
      type: "default",
      style: { strokeWidth: 2, stroke: "#64748b" },
      labelStyle: { fill: "#1e293b", fontSize: 12, fontWeight: 600 },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9, stroke: "#cbd5e1" },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
    };
    setEdges((prev) => [...prev, newEdge]);
  };

  const onNodeClick = (_: React.MouseEvent, node: FlowNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setSheetOpen(true);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: FlowEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setSheetOpen(true);
  };

  const addNode = (type: NodeType) => {
    const id = `node_${Date.now()}_${Math.random()}`;
    const center = { x: 250, y: 100 + nodes.length * 80 };

    const newNode: FlowNode = {
      id,
      type: "default",
      position: center,
      data: {
        type,
        label: NODE_TYPE_LABELS[type],
        assignee_id: null,
        assignee_type: "user",
        sla_hours: null,
        sla_unit: "hours",
        sla_working_hours_only: false,
        config: {},
      },
      style: {
        ...nodeStyleByType[type],
        padding: "12px 8px",
        borderRadius: 8,
        fontSize: 12,
        minWidth: 140,
        textAlign: "center",
        fontWeight: 500,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        cursor: "pointer",
      },
    };

    setNodes((prev) => [...prev, newNode]);
    toast.success(`Добавлен узел: ${NODE_TYPE_LABELS[type]}`);
  };

  const deleteNode = () => {
    if (!selectedNode) return;

    const connectedEdges = edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );

    setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    
    setSheetOpen(false);
    setSelectedNode(null);
    setDeleteConfirmOpen(false);
    
    toast.success(`Узел "${selectedNode.data.label}" и ${connectedEdges.length} связей удалены`);
  };

  const deleteEdge = () => {
    if (!selectedEdge) return;
    
    setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
    setSheetOpen(false);
    setSelectedEdge(null);
    toast.success("Связь удалена");
  };

  const updateNodeData = (updates: Partial<WorkflowNodeData>) => {
    if (!selectedNode) return;
    
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, ...updates } }
          : n
      )
    );
    
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, ...updates } } : null
    );
  };

  const updateEdgeData = (updates: { label?: string; condition?: string }) => {
    if (!selectedEdge) return;
    
    setEdges((prev) =>
      prev.map((e) =>
        e.id === selectedEdge.id
          ? {
              ...e,
              label: updates.label,
              data: { ...e.data, condition: updates.condition },
            }
          : e
      )
    );
    
    setSelectedEdge((prev) =>
      prev
        ? {
            ...prev,
            label: updates.label,
            data: { ...prev.data, condition: updates.condition },
          }
        : null
    );
  };

  /* ===================== CONDITION BUILDER ===================== */
  
  const parseCondition = (conditionStr: string = "") => {
    // Простой парсер для демонстрации
    const patterns = [
      { regex: /(\w+)\s*(===|!==|>=|<=|>|<)\s*['"](.+)['"]/, fields: ["field", "operator", "value"] },
      { regex: /(\w+)\s*(includes|startsWith|endsWith)\s*['"](.+)['"]/, fields: ["field", "operator", "value"] },
    ];
    
    for (const pattern of patterns) {
      const match = conditionStr.match(pattern.regex);
      if (match) {
        const result: Record<string, string> = {};
        pattern.fields.forEach((field, idx) => {
          result[field] = match[idx + 1];
        });
        return result as { field: string; operator: string; value: string };
      }
    }
    
    return { field: "", operator: "===", value: "" };
  };

  const buildCondition = (field: string, operator: string, value: string) => {
    if (!field || !value) return "";
    
    if (operator === "includes") {
      return `${field}.includes('${value}')`;
    }
    if (operator === "startsWith") {
      return `${field}.startsWith('${value}')`;
    }
    if (operator === "endsWith") {
      return `${field}.endsWith('${value}')`;
    }
    
    return `${field} ${operator} '${value}'`;
  };

  const handleVisualConditionChange = (field: string, operator: string, value: string) => {
    const condition = buildCondition(field, operator, value);
    updateEdgeData({ condition });
  };

  const parsedCondition = parseCondition(selectedEdge?.data?.condition);

  /* ===================== VALIDATION ===================== */
  
  const validateWorkflow = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    const hasStart = nodes.some(n => n.data.type === "START");
    const hasEnd = nodes.some(n => n.data.type === "END");
    
    if (!hasStart) errors.push("Отсутствует стартовый узел (START)");
    if (!hasEnd) errors.push("Отсутствует конечный узел (END)");
    
    nodes.forEach(node => {
      const hasIncoming = edges.some(e => e.target === node.id);
      const hasOutgoing = edges.some(e => e.source === node.id);
      
      if (node.data.type !== "START" && !hasIncoming) {
        errors.push(`Узел "${node.data.label}" не имеет входящих связей`);
      }
      if (node.data.type !== "END" && !hasOutgoing) {
        errors.push(`Узел "${node.data.label}" не имеет исходящих связей`);
      }
    });
    
    // Проверка на циклы
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (hasCycle(edge.target)) return true;
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    const startNode = nodes.find(n => n.data.type === "START");
    if (startNode && hasCycle(startNode.id)) {
      errors.push("Обнаружен цикл в маршруте workflow. Убедитесь, что путь всегда достигает конечного узла.");
    }
    
    setValidationErrors(errors);
    return { isValid: errors.length === 0, errors };
  }, [nodes, edges]);
  
  /* ===================== SAVE ===================== */

  const saveWorkflow = async () => {
    const { isValid, errors } = validateWorkflow();
    
    if (!isValid) {
      toast.error("Пожалуйста, исправьте ошибки перед сохранением");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const definition: WorkflowDefinition = {
        nodes: nodes.map(toDomainNode),
        edges: edges.map(toDomainEdge),
      };
      
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
      setValidationErrors([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  /* ===================== HELPERS ===================== */
  
  const getAssigneeOptions = (): ComboboxOption[] => {
    const assigneeType = selectedNode?.data.assignee_type || "user";
    
    switch (assigneeType) {
      case "user":
        return (users || []).map(u => ({ 
          value: u.id, 
          label: `${u.name} (${u.role})`,
          metadata: u 
        }));
      case "role":
        return (roles || []).map(r => ({ 
          value: r.id, 
          label: r.name,
          metadata: r 
        }));
      case "department":
        return (departments || []).map(d => ({ 
          value: d.id, 
          label: d.name,
          metadata: d 
        }));
      default:
        return [];
    }
  };

  const getDocumentFieldOptions = (): ComboboxOption[] => {
    return (documentFields || []).map(f => ({ 
      value: f.id, 
      label: f.label,
      metadata: f 
    }));
  };

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

            <Button size="sm" onClick={saveWorkflow} disabled={isSaving}>
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        }
      />

      <PageBody className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-9rem)]">
        {/* Левая панель инструментов */}
        <div className="space-y-4 overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Название (RU)</Label>
            <Input 
              value={nameRu} 
              onChange={(e) => setNameRu(e.target.value)} 
              placeholder="Название на русском" 
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Название (KK)</Label>
            <Input 
              value={nameKk} 
              onChange={(e) => setNameKk(e.target.value)} 
              placeholder="Қазақша атауы" 
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Описание</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание workflow"
              rows={3}
            />
          </div>

          {/* Ошибки валидации */}
          {validationErrors.length > 0 && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-1">
              <Label className="text-red-800 text-sm font-semibold">Ошибки валидации:</Label>
              {validationErrors.map((error, idx) => (
                <div key={idx} className="text-red-700 text-xs flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          {/* Добавление узлов */}
          <div className="border-t pt-4">
            <Label className="text-sm font-semibold mb-2 block">Добавить узел</Label>
            <div className="grid grid-cols-2 gap-2">
              {NODE_TYPES.map((tp) => (
                <Button
                  key={tp}
                  size="sm"
                  variant="outline"
                  onClick={() => addNode(tp)}
                  className="justify-start px-2"
                >
                  <span className="mr-1">{NODE_TYPE_ICONS[tp]}</span>
                  <span className="text-xs">{NODE_TYPE_LABELS[tp]}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Статистика */}
          <div className="border-t pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Узлов: {nodes.length}</div>
              <div>Связей: {edges.length}</div>
            </div>
          </div>
        </div>

        {/* ReactFlow граф */}
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="#e2e8f0" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor="#94a3b8" />
          </ReactFlow>
        </div>
      </PageBody>

      {/* Панель редактирования */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} modal={false}>
        <SheetContent className="w-[450px] sm:w-[540px] overflow-y-auto shadow-xl border-l" style={{ zIndex: 40 }}>
          
          {/* Редактирование узла */}
          {selectedNode && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span>{NODE_TYPE_ICONS[selectedNode.data.type]}</span>
                  <span>Редактирование узла</span>
                </SheetTitle>
                <SheetDescription>
                  Тип: {NODE_TYPE_LABELS[selectedNode.data.type]}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label>Название узла (RU)</Label>
                  <Input
                    value={selectedNode.data.label || ""}
                    onChange={(e) => updateNodeData({ label: e.target.value })}
                    placeholder="Название на русском"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Название узла (KK)</Label>
                  <Input
                    value={(selectedNode.data.config?.label_kk as string) || ""}
                    onChange={(e) => updateNodeData({ 
                      config: { ...selectedNode.data.config, label_kk: e.target.value } 
                    })}
                    placeholder="Қазақша атауы"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Textarea
                    value={selectedNode.data.description || ""}
                    onChange={(e) => updateNodeData({ description: e.target.value })}
                    placeholder="Описание узла"
                    rows={3}
                  />
                </div>

                {/* Блок ответственного */}
                {(selectedNode.data.type === "APPROVAL" || selectedNode.data.type === "SIGNATURE" || selectedNode.data.type === "TASK") && (
                  <>
                    <div className="space-y-2">
                      <Label>Тип ответственного</Label>
                      <Select 
                        value={selectedNode.data.assignee_type || "user"} 
                        onValueChange={(v: AssigneeType) => updateNodeData({ assignee_type: v, assignee_id: null })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Конкретный сотрудник</SelectItem>
                          <SelectItem value="role">Роль / Должность</SelectItem>
                          <SelectItem value="department">Подразделение</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {selectedNode.data.assignee_type === "user" ? "Сотрудник" : 
                         selectedNode.data.assignee_type === "role" ? "Роль" : "Подразделение"}
                      </Label>
                      <Combobox
                        options={getAssigneeOptions()}
                        value={selectedNode.data.assignee_id || undefined}
                        onChange={(value: string) => updateNodeData({ assignee_id: value || null })}
                        placeholder={`Выберите ${
                          selectedNode.data.assignee_type === "user" ? "сотрудника" : 
                          selectedNode.data.assignee_type === "role" ? "роль" : "подразделение"
                        }`}
                        disabled={!users && !roles && !departments}
                        isLoading={!users && !roles && !departments}
                      />
                    </div>
                  </>
                )}

                {/* Блок SLA */}
                {(selectedNode.data.type === "APPROVAL" || selectedNode.data.type === "SIGNATURE" || 
                  selectedNode.data.type === "TIMER" || selectedNode.data.type === "ESCALATION") && (
                  <>
                    <div className="space-y-2">
                      <Label>SLA (Service Level Agreement)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          className="flex-1"
                          value={selectedNode.data.sla_hours !== null && selectedNode.data.sla_hours !== undefined ? String(selectedNode.data.sla_hours) : ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateNodeData({ sla_hours: value === "" ? null : Number(value) });
                          }}
                          placeholder="0"
                        />
                        <Select 
                          value={selectedNode.data.sla_unit || "hours"} 
                          onValueChange={(v: "hours" | "business_days") => updateNodeData({ sla_unit: v })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hours">Часы</SelectItem>
                            <SelectItem value="business_days">Рабочие дни</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="workingHoursOnly"
                        checked={selectedNode.data.sla_working_hours_only || false}
                        onChange={(e) => updateNodeData({ sla_working_hours_only: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="workingHoursOnly" className="text-sm font-normal cursor-pointer">
                        Учитывать только рабочее время (согласно производственному календарю)
                      </Label>
                    </div>
                  </>
                )}

                {/* Кнопка удаления */}
                <div className="border-t pt-4">
                  <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)} className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить узел
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Редактирование связи */}
          {selectedEdge && (
            <>
              <SheetHeader>
                <SheetTitle>Редактирование перехода</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-2 text-sm text-slate-700">
                  <span className="font-medium px-2 py-1 bg-slate-100 rounded border">
                    {nodes.find((n) => n.id === selectedEdge.source)?.data.label || selectedEdge.source}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="font-medium px-2 py-1 bg-slate-100 rounded border">
                    {nodes.find((n) => n.id === selectedEdge.target)?.data.label || selectedEdge.target}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Метка на схеме</Label>
                  <Input
                    value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""}
                    onChange={(e) => updateEdgeData({ label: e.target.value })}
                    placeholder="Например: Согласовано, Отклонено, Да, Нет"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Этот текст будет отображаться на стрелке в визуальном редакторе
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Условие перехода</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs px-2"
                      onClick={() => setIsRawCondition(!isRawCondition)}
                    >
                      {isRawCondition ? (
                        <MousePointerSquareDashed className="w-3 h-3 mr-1" />
                      ) : (
                        <Code2 className="w-3 h-3 mr-1" />
                      )}
                      {isRawCondition ? "Визуальный билдер" : "Режим кода"}
                    </Button>
                  </div>

                  {!isRawCondition ? (
                    <div className="bg-slate-50 border rounded-md p-3 space-y-3">
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Поле документа</label>
                          <Select 
                            value={parsedCondition.field} 
                            onValueChange={(v) => handleVisualConditionChange(v, parsedCondition.operator, parsedCondition.value)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Выберите поле..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(documentFields || []).map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Оператор</label>
                          <Select 
                            value={parsedCondition.operator} 
                            onValueChange={(v) => handleVisualConditionChange(parsedCondition.field, v, parsedCondition.value)}
                          >
                            <SelectTrigger className="bg-white w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATORS.map(op => (
                                <SelectItem key={op.id} value={op.id}>{op.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Значение</label>
                          <Input 
                            placeholder="Значение" 
                            className="bg-white"
                            value={parsedCondition.value}
                            onChange={(e) => handleVisualConditionChange(parsedCondition.field, parsedCondition.operator, e.target.value)}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Документ пойдет по этому маршруту, если выполнится указанное условие
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={selectedEdge.data?.condition || ""}
                        onChange={(e) => updateEdgeData({ condition: e.target.value })}
                        placeholder="Пример: data.status === 'APPROVED' &amp;&amp; data.amount > 10000"
                        className="font-mono text-sm bg-slate-900 text-green-400"
                        rows={4}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Используйте JavaScript выражение, которое возвращает true/false. 
                        Доступные переменные: <code className="text-xs bg-slate-100 px-1">data</code> - данные документа
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Button variant="destructive" onClick={deleteEdge} className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить связь
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      
      {/* Диалог подтверждения удаления */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены, что хотите удалить узел?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedNode && (
                <>
                  Узел <strong>"{selectedNode.data.label}"</strong> и все его связи будут удалены без возможности восстановления.
                  {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length > 0 && (
                    <span className="block mt-2 text-amber-600">
                      ⚠️ Будут удалены все {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length} связанных переходов.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={deleteNode} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
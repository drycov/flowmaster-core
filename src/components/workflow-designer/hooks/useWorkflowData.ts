import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWorkflow } from "@/lib/api/workflows.functions";
import type { WorkflowDefinition, WorkflowStatus } from "../types";

interface UseWorkflowDataReturn {
  id: string;
  nameRu: string;
  nameKk: string;
  description: string;
  status: WorkflowStatus;
  definition: WorkflowDefinition | null;
  version: number;
  isLoading: boolean;
  setNameRu: (value: string) => void;
  setNameKk: (value: string) => void;
  setDescription: (value: string) => void;
  setStatus: (value: WorkflowStatus) => void;
}

export function useWorkflowData(workflowId: string): UseWorkflowDataReturn {
  const { data: wf, isLoading } = useQuery({
    queryKey: ["wf", workflowId],
    queryFn: () => getWorkflow({ data: { id: workflowId } }),
  });

  const [nameRu, setNameRu] = useState("");
  const [nameKk, setNameKk] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<WorkflowStatus>("draft");
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [version, setVersion] = useState(1);

  useEffect(() => {
    if (!wf) return;

    setNameRu(wf.name_ru);
    setNameKk(wf.name_kk);
    setDescription(wf.description || "");
    setStatus(wf.status as WorkflowStatus);
    setVersion((wf as { version?: number }).version ?? 1);
    const def = wf.definition as unknown;
    setDefinition(def as WorkflowDefinition);
  }, [wf]);

  return {
    id: workflowId,
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
  };
}
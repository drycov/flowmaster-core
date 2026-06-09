import { useState, useCallback } from "react";
import type { TFunction } from "@/i18n";
import { validateWorkflow, type ValidationResult } from "../utils/validators";
import type { FlowNode, FlowEdge } from "../types";

interface UseWorkflowValidationReturn {
  validationErrors: string[];
  isValid: boolean;
  validate: (nodes: FlowNode[], edges: FlowEdge[]) => boolean;
  clearErrors: () => void;
}

export function useWorkflowValidation(t: TFunction): UseWorkflowValidationReturn {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: [],
  });

  const validate = useCallback(
    (nodes: FlowNode[], edges: FlowEdge[]): boolean => {
      const result = validateWorkflow(nodes, edges, t);
      setValidationResult(result);
      return result.isValid;
    },
    [t],
  );

  const clearErrors = useCallback(() => {
    setValidationResult({ isValid: true, errors: [] });
  }, []);

  return {
    validationErrors: validationResult.errors,
    isValid: validationResult.isValid,
    validate,
    clearErrors,
  };
}

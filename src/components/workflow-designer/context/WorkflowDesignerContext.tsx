import { createContext, useContext, type ReactNode } from "react";
import type { AssigneeLookup } from "@/lib/workflow/assignee-display";

const WorkflowDesignerContext = createContext<AssigneeLookup | null>(null);

export function WorkflowDesignerProvider({
  lookup,
  children,
}: {
  lookup: AssigneeLookup;
  children: ReactNode;
}) {
  return (
    <WorkflowDesignerContext.Provider value={lookup}>{children}</WorkflowDesignerContext.Provider>
  );
}

export function useWorkflowDesignerLookup(): AssigneeLookup {
  const ctx = useContext(WorkflowDesignerContext);
  return (
    ctx ?? {
      positions: [],
      departments: [],
      users: [],
      roles: [],
    }
  );
}

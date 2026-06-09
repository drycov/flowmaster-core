import type { ReactNode } from "react";
import { useAccessContext } from "@/lib/access/hooks";
import type { ModuleAction, ModuleId } from "@/lib/access/types";

type ModuleGateProps = {
  moduleId: ModuleId;
  action?: ModuleAction;
  children: ReactNode;
  fallback?: ReactNode;
};

/** Renders children only when the user passes module RBAC + license gate. */
export function ModuleGate({
  moduleId,
  action = "read",
  children,
  fallback = null,
}: ModuleGateProps) {
  const { canModule, isLoading } = useAccessContext();
  if (isLoading) return null;
  if (!canModule(moduleId, action)) return <>{fallback}</>;
  return <>{children}</>;
}

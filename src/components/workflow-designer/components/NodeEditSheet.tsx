import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NODE_TYPE_LABEL_KEYS } from "../constants";
import { WorkflowNodeIcon } from "./WorkflowNodeIcon";
import { useI18n } from "@/i18n";
import { NodePropertiesForm } from "./NodePropertiesForm";
import type { FlowNode, User, Role, Department } from "../types";

interface NodeEditSheetProps {
  open: boolean;
  node: FlowNode | null;
  users?: User[];
  roles?: Role[];
  departments?: Department[];
  onClose: () => void;
  onUpdate: (updates: Partial<FlowNode["data"]>) => void;
  onDelete: () => void;
  onDeleteConfirm: () => void;
}

/** @deprecated Prefer inline PropertiesPanel in the workflow designer page. */
export function NodeEditSheet({
  open,
  node,
  users,
  roles,
  departments,
  onClose,
  onUpdate,
  onDeleteConfirm,
}: NodeEditSheetProps) {
  const { t } = useI18n();
  if (!node) return null;

  return (
    <Sheet open={open} onOpenChange={onClose} modal={false}>
      <SheetContent className="w-[450px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <WorkflowNodeIcon type={node.data.type} className="h-5 w-5" />
            <span>{t("wf.editNode")}</span>
          </SheetTitle>
          <SheetDescription>
            {t("common.type")}: {t(NODE_TYPE_LABEL_KEYS[node.data.type])}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <NodePropertiesForm
            node={node}
            users={users}
            roles={roles}
            departments={departments}
            onUpdate={onUpdate}
            onDelete={onDeleteConfirm}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

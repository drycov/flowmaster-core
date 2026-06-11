import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { EdgePropertiesForm } from "./EdgePropertiesForm";
import type { FlowNode, FlowEdge, DocumentField } from "../types";

interface EdgeEditSheetProps {
  open: boolean;
  edge: FlowEdge | null;
  sourceNode?: FlowNode;
  targetNode?: FlowNode;
  documentFields?: DocumentField[];
  onClose: () => void;
  onUpdate: (updates: { label?: string; condition?: string }) => void;
  onDelete: () => void;
}

/** @deprecated Prefer inline PropertiesPanel in the workflow designer page. */
export function EdgeEditSheet({
  open,
  edge,
  sourceNode,
  targetNode,
  documentFields,
  onClose,
  onUpdate,
  onDelete,
}: EdgeEditSheetProps) {
  const { t } = useI18n();
  if (!edge) return null;

  return (
    <Sheet open={open} onOpenChange={onClose} modal={false}>
      <SheetContent className="w-[450px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{t("wf.editEdge")}</SheetTitle>
          <SheetDescription>{t("wf.properties.edge")}</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <EdgePropertiesForm
            edge={edge}
            sourceNode={sourceNode}
            targetNode={targetNode}
            documentFields={documentFields}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

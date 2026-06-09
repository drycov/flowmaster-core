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
import { useI18n } from "@/i18n";
import type { FlowNode } from "../types";

interface DeleteConfirmDialogProps {
  open: boolean;
  node: FlowNode | null;
  connectedEdgesCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  node,
  connectedEdgesCount,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const { t } = useI18n();

  if (!node) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("wf.deleteNodeConfirm")}</AlertDialogTitle>
          <AlertDialogDescription>
            {node.data.label}
            {connectedEdgesCount > 0 && (
              <span className="block mt-2 text-amber-600">{connectedEdgesCount}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

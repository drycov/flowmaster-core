import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { FlowNode, FlowEdge } from "../types";

interface DeleteConfirmDialogProps {
  open: boolean;
  node: FlowNode | null;
  connectedEdgesCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ open, node, connectedEdgesCount, onClose, onConfirm }: DeleteConfirmDialogProps) {
  if (!node) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Вы уверены, что хотите удалить узел?</AlertDialogTitle>
          <AlertDialogDescription>
            Узел <strong>"{node.data.label}"</strong> и все его связи будут удалены без возможности восстановления.
            {connectedEdgesCount > 0 && (
              <span className="block mt-2 text-amber-600">
                ⚠️ Будут удалены все {connectedEdgesCount} связанных переходов.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
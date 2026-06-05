import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addComment, addSignature, updateDocumentStatus } from "@/lib/api/documents.functions";
import { listWorkflows, startWorkflow } from "@/lib/api/workflows.functions";
import { signCMS } from "@/lib/ncalayer";
import { toast } from "sonner";
import type { Workflow } from "../types";

export function useDocumentActions(documentId: string) {
  const qc = useQueryClient();

  const { data: workflows } = useQuery({
    queryKey: ["wfs-pub"],
    queryFn: () => listWorkflows(),
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => addComment({ data: { document_id: documentId, body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      toast.success("Комментарий добавлен");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ошибка при добавлении комментария"),
  });

  const startWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => startWorkflow({ data: { workflow_id: workflowId, document_id: documentId } }),
    onSuccess: () => {
      toast.success("Маршрут запущен");
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ошибка при запуске маршрута"),
  });

  const archiveMutation = useMutation({
    mutationFn: () => updateDocumentStatus({ data: { id: documentId, status: "archived" } }),
    onSuccess: () => {
      toast.success("Документ архивирован");
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ошибка при архивации"),
  });

  const signMutation = useMutation({
    mutationFn: async (payload: string) => {
      const result = await signCMS(payload);
      await addSignature({ data: { document_id: documentId, payload: result.signature, signature_type: "CMS" } });
    },
    onSuccess: () => {
      toast.success("Подпись добавлена");
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ошибка при подписании"),
  });

  const handleSign = async (documentBody?: string) => {
    const payload = documentBody ? btoa(unescape(encodeURIComponent(documentBody))) : "";
    await signMutation.mutateAsync(payload);
  };

  return {
    workflows: workflows?.filter((w: Workflow) => w.status === "published") || [],
    addComment: addCommentMutation.mutate,
    isAddingComment: addCommentMutation.isPending,
    startWorkflow: startWorkflowMutation.mutate,
    isStartingWorkflow: startWorkflowMutation.isPending,
    archive: archiveMutation.mutate,
    isArchiving: archiveMutation.isPending,
    sign: handleSign,
    isSigning: signMutation.isPending,
  };
}
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addComment, addSignature, updateDocumentStatus } from "@/lib/api/documents.functions";
import { listWorkflows, startWorkflow } from "@/lib/api/workflows.functions";
import { getDocument } from "@/lib/api/documents.functions";
import { parseStoredCustomRoute } from "@/lib/workflow/route-builder";
import { signCMSFull } from "@/lib/ncalayer";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import type { Workflow } from "../types";

export function useDocumentActions(documentId: string) {
  const qc = useQueryClient();
  const { t } = useI18n();

  const { data: workflows } = useQuery({
    queryKey: ["wfs-pub"],
    queryFn: () => listWorkflows(),
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => addComment({ data: { document_id: documentId, body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      toast.success(t("doc.commentAdded"));
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("doc.commentError")),
  });

  const startWorkflowMutation = useMutation({
    mutationFn: async (workflowId?: string) => {
      const docData = await getDocument({ data: { id: documentId } });
      const doc = docData.document as {
        workflow_id?: string | null;
        custom_route?: unknown;
      };
      const parsed = parseStoredCustomRoute(doc.custom_route);
      return startWorkflow({
        data: {
          document_id: documentId,
          workflow_id: workflowId ?? doc.workflow_id ?? null,
          graph_definition: parsed.graph,
          custom_route: parsed.steps as never,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("doc.workflowStarted"));
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("doc.workflowStartError")),
  });

  const archiveMutation = useMutation({
    mutationFn: () => updateDocumentStatus({ data: { id: documentId, status: "archived" } }),
    onSuccess: () => {
      toast.success(t("doc.archived"));
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("doc.archiveError")),
  });

  const signMutation = useMutation({
    mutationFn: async (payload: string) => {
      const result = await signCMSFull(payload);
      await addSignature({
        data: {
          document_id: documentId,
          payload: result.signature,
          signature_type: "CMS",
          cert_subject: result.certInfo.subject ?? null,
          cert_serial: result.certInfo.serial ?? null,
          cert_issuer: result.certInfo.issuer ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("doc.signatureAdded"));
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("doc.signatureError")),
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
    handleSign,
    isSigning: signMutation.isPending,
  };
}

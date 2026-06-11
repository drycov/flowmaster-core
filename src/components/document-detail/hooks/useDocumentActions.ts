import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addComment,
  addSignature,
  updateDocumentMetadata,
  updateDocumentStatus,
} from "@/lib/api/documents.functions";
import { listWorkflows, startWorkflow } from "@/lib/api/workflows.functions";
import { getDocument } from "@/lib/api/documents.functions";
import { parseStoredCustomRoute, toGraphRouteInput } from "@/lib/workflow/route-builder";
import { hasStoredWorkflowRoute } from "@/lib/workflow/start-route.server";
import { signCMSFull } from "@/lib/ncalayer";
import { buildSignatureInsertData } from "@/lib/eds/build-signature-record";
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
    onError: (error) => toast.error(error instanceof Error ? error.message : t("doc.commentError")),
  });

  const startWorkflowMutation = useMutation({
    mutationFn: async (workflowId?: string) => {
      const docData = (await getDocument({ data: { id: documentId } })) as {
        document: {
          workflow_id?: string | null;
          custom_route?: unknown;
        };
      };
      const doc = docData.document as {
        workflow_id?: string | null;
        custom_route?: unknown;
      };
      const parsed = parseStoredCustomRoute(doc.custom_route);
      const graphInput = toGraphRouteInput(parsed.graph);
      return startWorkflow({
        data: {
          document_id: documentId,
          workflow_id: workflowId ?? doc.workflow_id ?? null,
          graph_definition: graphInput,
          custom_route: (parsed.steps ?? graphInput) as never,
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
    onError: (error) => toast.error(error instanceof Error ? error.message : t("doc.archiveError")),
  });

  const saveContentMutation = useMutation({
    mutationFn: (body: string) => updateDocumentMetadata({ data: { id: documentId, body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      toast.success(t("doc.saved"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("doc.saveError")),
  });

  const signMutation = useMutation({
    mutationFn: async (signText: string) => {
      const payload = signText ? btoa(unescape(encodeURIComponent(signText))) : "";
      const result = await signCMSFull(payload);
      await addSignature({
        data: buildSignatureInsertData({
          documentId,
          signText,
          result,
        }),
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
    await signMutation.mutateAsync(documentBody ?? documentId);
  };

  return {
    workflows: workflows?.filter((w: Workflow) => w.status === "published") || [],
    addComment: addCommentMutation.mutate,
    isAddingComment: addCommentMutation.isPending,
    startWorkflow: startWorkflowMutation.mutate,
    isStartingWorkflow: startWorkflowMutation.isPending,
    archive: archiveMutation.mutate,
    isArchiving: archiveMutation.isPending,
    saveContent: async (body: string) => {
      await saveContentMutation.mutateAsync(body);
    },
    isSavingContent: saveContentMutation.isPending,
    handleSign,
    isSigning: signMutation.isPending,
  };
}

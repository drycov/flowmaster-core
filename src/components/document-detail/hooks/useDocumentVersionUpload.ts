import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { uploadAuthenticatedFile } from "@/lib/storage/client";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  prepareDocumentVersionUpload,
  registerDocumentVersion,
} from "@/lib/api/storage.functions";

export function useDocumentVersionUpload(documentId: string) {
  const qc = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async ({ file, comment }: { file: File; comment?: string }) => {
      const plan = await prepareDocumentVersionUpload({
        data: {
          document_id: documentId,
          filename: file.name,
          comment: comment ?? null,
        },
      });

      await uploadAuthenticatedFile(STORAGE_BUCKETS.documents, plan.storage_path, file);

      return registerDocumentVersion({
        data: {
          document_id: documentId,
          storage_path: plan.storage_path,
          version_no: plan.version_no,
          file_format: plan.file_format,
          comment: plan.comment,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      toast.success(t("doc.versionUploaded"));
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t("doc.versionUploadError"));
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n, interpolate } from "@/i18n";
import { uploadAuthenticatedFile } from "@/lib/storage/client";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { prepareTemplateUpload, uploadTemplateFile } from "@/lib/api/storage.functions";
import { syncTemplateFieldsFromFile } from "@/lib/api/templates.functions";
import { detectTemplateFormat, supportsTemplateProcessing } from "@/lib/templates/file-formats";
import type { TemplateSyncResult } from "../types";

export function useTemplateFileUpload(
  templateId: string,
  onSynced?: (result: TemplateSyncResult) => void,
) {
  const qc = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (file: File) => {
      const format = detectTemplateFormat(file.name);
      if (!format) {
        throw new Error(t("tpl.fileTemplate.invalidFormat"));
      }

      const plan = await prepareTemplateUpload({
        data: { template_id: templateId, filename: file.name },
      });

      await uploadAuthenticatedFile(STORAGE_BUCKETS.templates, plan.storage_path, file, {
        upsert: true,
      });

      const result = await uploadTemplateFile({
        data: {
          template_id: templateId,
          storage_path: plan.storage_path,
        },
      });

      let synced: Awaited<ReturnType<typeof syncTemplateFieldsFromFile>> | null = null;

      if (supportsTemplateProcessing(result.file_format)) {
        synced = await syncTemplateFieldsFromFile({
          data: { template_id: templateId },
        });
        onSynced?.({
          fields: synced.fields,
          metadata: synced.metadata,
          metadata_updated: synced.metadata_updated,
        });
      }

      return { ...result, synced };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["tpl", templateId] });
      qc.invalidateQueries({ queryKey: ["tpls"] });
      toast.success(t("tpl.fileUploaded"));

      const added = result.synced?.added ?? 0;
      if (added > 0) {
        toast.success(
          interpolate(t("tpl.fileTemplate.fieldsFound"), { count: String(added) }),
        );
      } else if (result.synced && result.synced.keys.length === 0) {
        toast.info(t("tpl.fileTemplate.noPlaceholders"));
      }

      if (result.synced?.metadata_updated) {
        toast.success(t("tpl.fileTemplate.metadataFilled"));
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t("tpl.fileUploadError"));
    },
  });
}

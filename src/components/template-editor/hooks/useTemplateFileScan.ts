import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n, interpolate } from "@/i18n";
import { syncTemplateFieldsFromFile } from "@/lib/api/templates.functions";
import type { TemplateSyncResult } from "../types";

export function useTemplateFileScan(
  templateId: string,
  onSynced?: (result: TemplateSyncResult) => void,
) {
  const qc = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async () => {
      const result = await syncTemplateFieldsFromFile({
        data: { template_id: templateId },
      });
      const payload: TemplateSyncResult = {
        fields: result.fields,
        metadata: result.metadata,
        metadata_updated: result.metadata_updated,
      };
      onSynced?.(payload);
      return result;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["tpl", templateId] });
      qc.invalidateQueries({ queryKey: ["tpls"] });
      if (result.keys.length === 0) {
        toast.info(t("tpl.fileTemplate.noPlaceholders"));
        return;
      }
      if (result.added > 0) {
        toast.success(
          interpolate(t("tpl.fileTemplate.fieldsFound"), { count: String(result.added) }),
        );
      } else {
        toast.info(t("tpl.fileTemplate.fieldsAlreadySynced"));
      }
      if (result.metadata_updated) {
        toast.success(t("tpl.fileTemplate.metadataFilled"));
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t("tpl.fileTemplate.scanError"));
    },
  });
}

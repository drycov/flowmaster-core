import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { syncTemplateFieldsFromFile } from "@/lib/api/templates.functions";
import { supportsTemplateProcessing } from "@/lib/templates/file-formats";
import type { Field, TemplateSyncResult } from "../types";

/** On editor open: parse DOCX/XLSX and populate fields + metadata when empty. */
export function useTemplateAutoSyncFields(options: {
  templateId: string;
  filePath: string | null;
  fileFormat: string | null;
  fields: Field[];
  isLoading: boolean;
  onSynced: (result: TemplateSyncResult) => void;
}) {
  const { templateId, filePath, fileFormat, fields, isLoading, onSynced } = options;
  const attemptedRef = useRef<string | null>(null);

  const sync = useMutation({
    mutationFn: () =>
      syncTemplateFieldsFromFile({ data: { template_id: templateId } }),
    onSuccess: (result) => {
      onSynced({
        fields: result.fields,
        metadata: result.metadata,
        metadata_updated: result.metadata_updated,
      });
    },
  });

  useEffect(() => {
    if (isLoading || sync.isPending) return;
    if (!filePath || !supportsTemplateProcessing(fileFormat)) return;
    if (fields.length > 0) return;

    const key = `${templateId}:${filePath}`;
    if (attemptedRef.current === key) return;
    attemptedRef.current = key;

    sync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per template file
  }, [isLoading, filePath, fileFormat, fields.length, templateId]);

  return { isSyncing: sync.isPending };
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileEdit, FileSpreadsheet, FileText, Loader2, Wand2 } from "lucide-react";
import { useI18n, interpolate } from "@/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  initializeDocumentOfficeFileFn,
  type OfficeInitOptions,
} from "@/lib/api/office.functions";

interface OfficeFileInitPanelProps {
  documentId: string;
  initOptions?: OfficeInitOptions;
}

export function OfficeFileInitPanel({ documentId, initOptions }: OfficeFileInitPanelProps) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const initMutation = useMutation({
    mutationFn: (mode: "blank_docx" | "blank_xlsx" | "from_template") =>
      initializeDocumentOfficeFileFn({ data: { document_id: documentId, mode } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["office-config", "document", documentId] });
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      toast.success(t("office.fileCreated"));
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t("office.fileCreateError"));
    },
  });

  const canEdit = initOptions?.can_edit ?? false;
  const fromTemplate = initOptions?.from_template ?? null;

  return (
    <div className="border-2 border-dashed border-border rounded-sm p-8 text-center text-sm text-muted-foreground space-y-4">
      <FileEdit className="w-8 h-8 mx-auto opacity-50" />
      <div className="space-y-1">
        <div className="font-medium text-foreground">ONLYOFFICE</div>
        <p>{t("office.noFileVersionHint")}</p>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            disabled={initMutation.isPending}
            onClick={() => initMutation.mutate("blank_docx")}
          >
            {initMutation.isPending && initMutation.variables === "blank_docx" ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-1" />
            )}
            {t("office.createBlankDocx")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={initMutation.isPending}
            onClick={() => initMutation.mutate("blank_xlsx")}
          >
            {initMutation.isPending && initMutation.variables === "blank_xlsx" ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-1" />
            )}
            {t("office.createBlankXlsx")}
          </Button>
          {fromTemplate && (
            <Button
              size="sm"
              variant="outline"
              disabled={initMutation.isPending}
              onClick={() => initMutation.mutate("from_template")}
            >
              {initMutation.isPending && initMutation.variables === "from_template" ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-1" />
              )}
              {interpolate(t("office.generateFromTemplate"), { name: fromTemplate.name })}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs">{t("office.noFileVersionReadOnly")}</p>
      )}

      <p className="text-xs">{t("office.uploadOnVersionsTab")}</p>
    </div>
  );
}

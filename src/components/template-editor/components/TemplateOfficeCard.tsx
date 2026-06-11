import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { getTemplateOfficeEditorConfig } from "@/lib/api/office.functions";
import { OnlyOfficeEmbed } from "@/components/office/OnlyOfficeEmbed";
import { TEMPLATE_FILE_EXTENSIONS } from "@/lib/templates/file-formats";

interface Props {
  templateId: string;
  filePath?: string | null;
  fileFormat?: string | null;
  status: string;
  /** Hide when ONLYOFFICE is used only for preview (non-draft templates). */
  editOnly?: boolean;
}

function supportsOfficeEditing(format: string | null | undefined): boolean {
  if (!format) return false;
  return (TEMPLATE_FILE_EXTENSIONS as readonly string[]).includes(format.toLowerCase());
}

export function TemplateOfficeCard({
  templateId,
  filePath,
  fileFormat,
  status,
  editOnly = false,
}: Props) {
  const { t } = useI18n();
  const queryKey = ["office-config", "template", templateId, filePath, status] as const;
  const enabled = Boolean(filePath && supportsOfficeEditing(fileFormat));

  const { data: officeConfig } = useQuery({
    queryKey,
    queryFn: () => getTemplateOfficeEditorConfig({ data: { template_id: templateId } }),
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  if (!enabled) return null;
  if (officeConfig?.reason === "office_not_configured") return null;
  if (editOnly && status !== "draft") return null;

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("tpl.fileTemplate.officeTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t("tpl.fileTemplate.officeHint")}</p>
        {status !== "draft" && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
            {t("tpl.fileTemplate.officeReadOnly")}
          </p>
        )}
        <OnlyOfficeEmbed
          editorId={`template-office-${templateId}`}
          queryKey={[...queryKey]}
          queryFn={() => getTemplateOfficeEditorConfig({ data: { template_id: templateId } })}
          heightClass="h-[560px]"
          showPlaceholderWhenUnavailable={false}
        />
      </CardContent>
    </Card>
  );
}

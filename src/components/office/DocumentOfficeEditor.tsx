import { useQuery } from "@tanstack/react-query";
import { getOfficeEditorConfig, isOfficeNotConfigured } from "@/lib/api/office.functions";
import { OnlyOfficeEmbed } from "@/components/office/OnlyOfficeEmbed";
import { OfficeFileInitPanel } from "@/components/office/OfficeFileInitPanel";

interface DocumentOfficeEditorProps {
  documentId: string;
  editorId?: string;
}

/** ONLYOFFICE editor for a document card — handles missing file initialization. */
export function DocumentOfficeEditor({
  documentId,
  editorId = "office-editor",
}: DocumentOfficeEditorProps) {
  const queryKey = ["office-config", "document", documentId] as const;

  const { data: officeConfig, isLoading } = useQuery({
    queryKey,
    queryFn: () => getOfficeEditorConfig({ data: { document_id: documentId } }),
    staleTime: 5 * 60 * 1000,
  });

  const officeUrl = officeConfig?.office_url ?? "";

  if (isLoading) {
    return (
      <OnlyOfficeEmbed
        editorId={editorId}
        queryKey={queryKey}
        queryFn={() => getOfficeEditorConfig({ data: { document_id: documentId } })}
        fill
      />
    );
  }

  if (
    officeConfig &&
    !officeConfig.available &&
    officeConfig.reason === "no_file_version" &&
    officeUrl
  ) {
    return (
      <OfficeFileInitPanel documentId={documentId} initOptions={officeConfig.init_options} />
    );
  }

  return (
    <OnlyOfficeEmbed
      editorId={editorId}
      queryKey={queryKey}
      queryFn={() => getOfficeEditorConfig({ data: { document_id: documentId } })}
      fill
      showPlaceholderWhenUnavailable={!isOfficeNotConfigured(officeConfig)}
    />
  );
}

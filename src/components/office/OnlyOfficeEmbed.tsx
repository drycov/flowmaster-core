import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileEdit, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { toast } from "sonner";

declare global {
  interface Window {
    DocsAPI?: { DocEditor: (id: string, config: unknown) => void };
  }
}

export type OfficeEditorConfigResponse =
  | {
      available: false;
      office_url: string | null;
      reason: string;
    }
  | {
      available: true;
      office_url: string;
      document_server_url: string;
      config: Record<string, unknown>;
    };

function loadOnlyOfficeScript(serverUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const src = `${serverUrl}/web-apps/apps/api/documents/api.js`;
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("ONLYOFFICE script load failed"));
    document.body.appendChild(script);
  });
}

interface OnlyOfficeEmbedProps {
  queryKey: readonly unknown[];
  queryFn: () => Promise<OfficeEditorConfigResponse>;
  editorId?: string;
  heightClass?: string;
  showPlaceholderWhenUnavailable?: boolean;
}

export function OnlyOfficeEmbed({
  queryKey,
  queryFn,
  editorId = "office-editor",
  heightClass = "h-[600px]",
  showPlaceholderWhenUnavailable = true,
}: OnlyOfficeEmbedProps) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedKey = useRef<string | null>(null);

  const { data: officeConfig, isLoading } = useQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000,
  });

  const officeUrl = officeConfig?.office_url || officeConfig?.document_server_url || "";
  const configKey =
    officeConfig?.available && officeConfig.document_server_url
      ? JSON.stringify(officeConfig.config)
      : null;

  useEffect(() => {
    if (!officeUrl || !officeConfig?.available || !officeConfig.document_server_url || !configKey) {
      return;
    }
    if (!hostRef.current) return;
    if (mountedKey.current === configKey) return;

    let cancelled = false;
    (async () => {
      try {
        await loadOnlyOfficeScript(officeConfig.document_server_url);
        if (cancelled || !window.DocsAPI || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        const mount = document.createElement("div");
        mount.id = editorId;
        mount.className = `w-full ${heightClass}`;
        hostRef.current.appendChild(mount);
        window.DocsAPI.DocEditor(editorId, officeConfig.config);
        mountedKey.current = configKey;
      } catch (e) {
        console.error(e);
        toast.error(t("office.loadError"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [officeUrl, officeConfig, configKey, editorId, heightClass, t]);

  if (!officeUrl && !isLoading && !officeConfig) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${heightClass} text-muted-foreground`}>
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t("common.loading")}
      </div>
    );
  }

  if (officeConfig?.available) {
    return <div ref={hostRef} className="relative w-full" />;
  }

  if (!showPlaceholderWhenUnavailable) return null;

  return (
    <div className="border-2 border-dashed border-border rounded-sm p-8 text-center text-sm text-muted-foreground space-y-2">
      <FileEdit className="w-8 h-8 mx-auto opacity-50" />
      <div className="font-medium text-foreground">ONLYOFFICE</div>
      <p>
        {officeConfig?.reason === "no_file_version"
          ? t("office.noFileVersion")
          : t("office.placeholder")}
      </p>
    </div>
  );
}

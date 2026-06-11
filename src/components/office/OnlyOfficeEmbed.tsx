import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileEdit, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { OfficeEditorConfigResponse } from "@/lib/api/office.functions";

export type { OfficeEditorConfigResponse };

declare global {
  interface Window {
    DocsAPI?: { DocEditor: (id: string, config: unknown) => void };
  }
}

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
  /** Stretch editor to fill the parent flex column (document card). */
  fill?: boolean;
  showPlaceholderWhenUnavailable?: boolean;
}

function notifyOfficeResize() {
  window.dispatchEvent(new Event("resize"));
}

function waitForHostHeight(host: HTMLElement, minHeight = 200): Promise<number> {
  return new Promise((resolve) => {
    let attempts = 0;
    const tick = () => {
      const height = host.clientHeight;
      if (height >= minHeight || attempts >= 30) {
        resolve(Math.max(height, minHeight));
        return;
      }
      attempts += 1;
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function OnlyOfficeEmbed({
  queryKey,
  queryFn,
  editorId = "office-editor",
  heightClass = "h-[600px]",
  fill = false,
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

  const officeUrl =
    officeConfig?.available === true
      ? officeConfig.document_server_url
      : (officeConfig?.office_url ?? "");
  const configKey =
    officeConfig?.available && officeConfig.document_server_url
      ? JSON.stringify(officeConfig.config)
      : null;

  const hostClassName = cn(
    "relative w-full",
    fill ? "min-h-[70vh] flex-1 h-full" : heightClass,
  );

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

        const hostHeight = fill
          ? await waitForHostHeight(hostRef.current)
          : hostRef.current.clientHeight || 600;
        if (cancelled || !hostRef.current) return;

        hostRef.current.innerHTML = "";
        const mount = document.createElement("div");
        mount.id = editorId;
        if (fill) {
          Object.assign(mount.style, {
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
          });
        } else {
          mount.className = `w-full ${heightClass}`;
        }
        hostRef.current.appendChild(mount);

        const initConfig =
          typeof officeConfig.config.token === "string"
            ? { token: officeConfig.config.token }
            : {
                ...officeConfig.config,
                width: "100%",
                height: fill ? `${hostHeight}px` : "600px",
              };
        window.DocsAPI.DocEditor(editorId, initConfig);
        mountedKey.current = configKey;
        requestAnimationFrame(() => notifyOfficeResize());
      } catch (e) {
        console.error(e);
        toast.error(t("office.loadError"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [officeUrl, officeConfig, configKey, editorId, heightClass, fill, t]);

  useEffect(() => {
    if (!fill || !hostRef.current || !officeConfig?.available) return;
    const node = hostRef.current;
    const ro = new ResizeObserver(() => notifyOfficeResize());
    ro.observe(node);
    return () => ro.disconnect();
  }, [fill, officeConfig?.available]);

  if (!officeUrl && !isLoading && !officeConfig) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-muted-foreground",
          fill ? hostClassName : heightClass,
        )}
      >
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t("common.loading")}
      </div>
    );
  }

  if (officeConfig?.available) {
    return <div ref={hostRef} className={hostClassName} />;
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

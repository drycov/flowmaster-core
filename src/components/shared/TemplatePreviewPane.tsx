import { useEffect, useRef, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { renderDocxPreview, type TemplatePreviewMode } from "@/lib/templates/preview";
import type { TemplatePreviewStatus } from "@/lib/templates/preview-types";

export type { TemplatePreviewStatus } from "@/lib/templates/preview-types";

function DocxPreviewPane({ blob, className }: { blob: Blob; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    setRenderError(null);
    setRendering(true);

    renderDocxPreview(blob, el, styleRef.current)
      .then(() => {
        if (!cancelled) setRendering(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setRenderError(e instanceof Error ? e.message : "DOCX preview error");
          setRendering(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (renderError) {
    return <p className="py-8 text-center text-sm text-destructive">{renderError}</p>;
  }

  return (
    <div className="relative min-h-[120px]">
      {rendering && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/80 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      <div ref={styleRef} className="docx-preview-styles" />
      <div ref={containerRef} className={className} />
    </div>
  );
}

function PreviewRefreshOverlay({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end p-2">
      <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {label}
      </span>
    </div>
  );
}

export function TemplatePreviewPane({
  status,
  isRefreshing,
  error,
  html,
  mode,
  docxBlob,
  fullscreen,
  fill,
  labels,
}: {
  status: TemplatePreviewStatus;
  isRefreshing?: boolean;
  error: string | null;
  html: string | null;
  mode: TemplatePreviewMode;
  docxBlob: Blob | null;
  fullscreen?: boolean;
  fill?: boolean;
  labels: {
    loading: string;
    error: string;
    empty: string;
    unsupported: string;
    refreshing?: string;
  };
}) {
  const heightClass = fullscreen
    ? "min-h-[70vh]"
    : fill
      ? "h-full min-h-0 flex-1"
      : "max-h-[520px]";
  const centerClass = fill ? "h-full min-h-0 flex-1" : heightClass;
  const refreshLabel = labels.refreshing ?? labels.loading;

  if (status === "loading" && !isRefreshing) {
    return (
      <div
        className={`flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground ${centerClass}`}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        {labels.loading}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`py-8 text-center text-sm text-destructive ${centerClass}`}>
        {error ?? labels.error}
      </div>
    );
  }

  if (mode === "empty") {
    return (
      <div className={`py-12 text-center text-sm text-muted-foreground ${centerClass}`}>
        <Eye className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p>{labels.empty}</p>
      </div>
    );
  }

  if (mode === "unsupported") {
    return (
      <div className={`py-8 text-center text-sm text-muted-foreground ${centerClass}`}>
        <p>{labels.unsupported}</p>
      </div>
    );
  }

  if (mode === "docx" && docxBlob) {
    return (
      <div
        className={`relative overflow-auto rounded-md border bg-white ${fill ? "h-full min-h-0 flex-1" : heightClass}`}
      >
        {isRefreshing && <PreviewRefreshOverlay label={refreshLabel} />}
        <DocxPreviewPane blob={docxBlob} className="docx-preview-wrapper p-2" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-auto rounded-md border bg-white p-4 prose prose-sm max-w-none ${fill ? "h-full min-h-0 flex-1" : heightClass}`}
    >
      {isRefreshing && <PreviewRefreshOverlay label={refreshLabel} />}
      <div dangerouslySetInnerHTML={{ __html: html ?? "" }} />
    </div>
  );
}

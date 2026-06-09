import { useEffect, useRef, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { renderDocxPreview, type TemplatePreviewMode } from "@/lib/templates/preview.client";

export type TemplatePreviewStatus = "idle" | "loading" | "ready" | "error";

function DocxPreviewPane({ blob, className }: { blob: Blob; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setRenderError(null);
    renderDocxPreview(blob, el, null).catch((e) => {
      setRenderError(e instanceof Error ? e.message : "DOCX preview error");
    });
  }, [blob]);

  if (renderError) {
    return <p className="py-8 text-center text-sm text-destructive">{renderError}</p>;
  }

  return <div ref={containerRef} className={className} />;
}

export function TemplatePreviewPane({
  status,
  error,
  html,
  mode,
  docxBlob,
  fullscreen,
  fill,
  labels,
}: {
  status: TemplatePreviewStatus;
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
  };
}) {
  const heightClass = fullscreen
    ? "min-h-[70vh]"
    : fill
      ? "h-full min-h-0 flex-1"
      : "max-h-[520px]";
  const centerClass = fill ? "h-full min-h-0 flex-1" : heightClass;

  if (status === "loading") {
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
        className={`overflow-auto rounded-md border bg-white ${fill ? "h-full min-h-0 flex-1" : heightClass}`}
      >
        <DocxPreviewPane blob={docxBlob} className="docx-preview-wrapper p-2" />
      </div>
    );
  }

  return (
    <div
      className={`overflow-auto rounded-md border bg-white p-4 prose prose-sm max-w-none ${fill ? "h-full min-h-0 flex-1" : heightClass}`}
      dangerouslySetInnerHTML={{ __html: html ?? "" }}
    />
  );
}

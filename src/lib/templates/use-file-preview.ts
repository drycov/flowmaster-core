import { useEffect, useRef, useState } from "react";
import { getSignedDownloadUrl } from "@/lib/api/storage.functions";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import type { TemplateFileFormat } from "@/lib/templates/file-formats";
import {
  buildBodyPreviewHtml,
  buildFilledBodyPreviewHtml,
  previewModeForFormat,
  xlsxBlobToPreviewHtml,
  type TemplateFieldLabel,
  type TemplatePreviewMode,
} from "@/lib/templates/preview";
import { renderTemplateFileClient } from "@/lib/templates/preview-render";
import type { TemplatePreviewStatus } from "@/lib/templates/preview-types";
import {
  PREVIEW_DEBOUNCE_MS,
  PREVIEW_FETCH_TIMEOUT_MS,
  PREVIEW_RENDER_TIMEOUT_MS,
  withTimeout,
} from "@/lib/templates/preview-utils";

export type PreviewBucket = "templates" | "documents";

export type HtmlBodyStrategy =
  | { kind: "editor-labels"; body: string; fields: TemplateFieldLabel[] }
  | { kind: "filled"; body: string; values: Record<string, string> };

export type UseFilePreviewOptions = {
  enabled?: boolean;
  filePath: string | null;
  fileFormat: string | null;
  body?: string;
  bucket: PreviewBucket;
  substitutePlaceholders: boolean;
  values?: Record<string, string>;
  htmlBody?: HtmlBodyStrategy | null;
  debounceMs?: number;
  reloadToken?: number;
};

const BUCKET_MAP = {
  templates: STORAGE_BUCKETS.templates,
  documents: STORAGE_BUCKETS.documents,
} as const;

async function buildHtmlFromStrategy(strategy: HtmlBodyStrategy): Promise<string> {
  if (strategy.kind === "editor-labels") {
    return buildBodyPreviewHtml(strategy.body, strategy.fields);
  }
  return buildFilledBodyPreviewHtml(strategy.body, strategy.values);
}

export function useFilePreview(options: UseFilePreviewOptions) {
  const {
    enabled = true,
    filePath,
    fileFormat,
    body = "",
    bucket,
    substitutePlaceholders,
    values = {},
    htmlBody = null,
    debounceMs = PREVIEW_DEBOUNCE_MS,
    reloadToken = 0,
  } = options;

  const [status, setStatus] = useState<TemplatePreviewStatus>("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [mode, setMode] = useState<TemplatePreviewMode>("empty");
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [sourceReady, setSourceReady] = useState(0);

  const sourceBlobRef = useRef<Blob | null>(null);
  const loadVersionRef = useRef(0);
  const renderVersionRef = useRef(0);
  const hasRenderedRef = useRef(false);

  const valuesKey = JSON.stringify(values);
  const htmlBodyKey = htmlBody ? JSON.stringify(htmlBody) : "";

  useEffect(() => {
    if (!enabled) {
      setMode("empty");
      setStatus("idle");
      setIsRefreshing(false);
      setError(null);
      setHtml(null);
      setDocxBlob(null);
      sourceBlobRef.current = null;
      hasRenderedRef.current = false;
      setSourceReady(0);
      return;
    }

    const nextMode = previewModeForFormat(fileFormat, filePath, body);
    setMode(nextMode);
    setError(null);
    setHtml(null);
    setDocxBlob(null);
    sourceBlobRef.current = null;
    hasRenderedRef.current = false;
    setSourceReady(0);
    setIsRefreshing(false);

    if (nextMode === "empty") {
      setStatus("idle");
      return;
    }

    if (nextMode === "unsupported") {
      setStatus("ready");
      return;
    }

    if (nextMode === "html" && !filePath) {
      setStatus("ready");
      return;
    }

    if (!filePath) {
      setStatus("error");
      setError("Файл не найден");
      return;
    }

    const loadVersion = ++loadVersionRef.current;
    setStatus("loading");

    (async () => {
      try {
        const { signed_url } = await withTimeout(
          getSignedDownloadUrl({
            data: { bucket: BUCKET_MAP[bucket], path: filePath },
          }),
          PREVIEW_FETCH_TIMEOUT_MS,
          "Превышено время ожидания загрузки файла",
        );
        const response = await withTimeout(
          fetch(signed_url),
          PREVIEW_FETCH_TIMEOUT_MS,
          "Превышено время ожидания загрузки файла",
        );
        if (!response.ok) throw new Error("Не удалось загрузить файл для предпросмотра");
        const blob = await response.blob();
        if (loadVersion !== loadVersionRef.current) return;
        sourceBlobRef.current = blob;
        setSourceReady((n) => n + 1);
      } catch (e) {
        if (loadVersion !== loadVersionRef.current) return;
        setError(e instanceof Error ? e.message : "Ошибка предпросмотра");
        setStatus("error");
      }
    })();
  }, [enabled, filePath, fileFormat, body, bucket, reloadToken]);

  useEffect(() => {
    if (!enabled || mode === "empty" || mode === "unsupported") return;

    const renderVersion = ++renderVersionRef.current;

    if (mode === "html" && !filePath && htmlBody) {
      if (hasRenderedRef.current) {
        setIsRefreshing(true);
      } else {
        setStatus("loading");
      }

      const run = () => {
        void (async () => {
          if (renderVersion !== renderVersionRef.current) return;
          setHtml(await buildHtmlFromStrategy(htmlBody));
          hasRenderedRef.current = true;
          setStatus("ready");
          setIsRefreshing(false);
        })();
      };

      if (debounceMs <= 0) {
        run();
        return;
      }

      const timer = window.setTimeout(run, debounceMs);
      return () => window.clearTimeout(timer);
    }

    const sourceBlob = sourceBlobRef.current;
    if (!sourceBlob || !fileFormat) return;

    if (hasRenderedRef.current) {
      setIsRefreshing(true);
    } else {
      setStatus("loading");
    }

    const runRender = async () => {
      try {
        const format = fileFormat as TemplateFileFormat;

        if (mode === "docx") {
          if (substitutePlaceholders) {
            const rendered = await withTimeout(
              renderTemplateFileClient(sourceBlob, format, values),
              PREVIEW_RENDER_TIMEOUT_MS,
              "Превышено время формирования предпросмотра DOCX",
            );
            if (renderVersion !== renderVersionRef.current) return;
            setDocxBlob(rendered);
          } else {
            if (renderVersion !== renderVersionRef.current) return;
            setDocxBlob(sourceBlob);
          }
          setHtml(null);
          hasRenderedRef.current = true;
          setStatus("ready");
          setIsRefreshing(false);
          return;
        }

        if (mode === "html" && format === "xlsx") {
          const blobForPreview = substitutePlaceholders
            ? await withTimeout(
                renderTemplateFileClient(sourceBlob, format, values),
                PREVIEW_RENDER_TIMEOUT_MS,
                "Превышено время формирования предпросмотра XLSX",
              )
            : sourceBlob;

          if (renderVersion !== renderVersionRef.current) return;
          setHtml(
            await withTimeout(
              xlsxBlobToPreviewHtml(blobForPreview),
              PREVIEW_RENDER_TIMEOUT_MS,
              "Превышено время отображения таблицы",
            ),
          );
          setDocxBlob(null);
          hasRenderedRef.current = true;
          setStatus("ready");
          setIsRefreshing(false);
        }
      } catch (e) {
        if (renderVersion !== renderVersionRef.current) return;
        setError(e instanceof Error ? e.message : "Ошибка предпросмотра");
        setStatus("error");
        setIsRefreshing(false);
      }
    };

    if (debounceMs <= 0) {
      void runRender();
      return;
    }

    const timer = window.setTimeout(() => {
      void runRender();
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [
    enabled,
    mode,
    filePath,
    fileFormat,
    body,
    valuesKey,
    htmlBodyKey,
    sourceReady,
    substitutePlaceholders,
    debounceMs,
  ]);

  return {
    status,
    isRefreshing,
    error,
    html,
    mode,
    docxBlob,
  };
}

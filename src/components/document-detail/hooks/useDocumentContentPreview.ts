import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { getSignedDownloadUrl } from "@/lib/api/storage.functions";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import type { TemplateFileFormat } from "@/lib/templates/file-formats";
import {
  previewModeForFormat,
  xlsxBlobToPreviewHtml,
  type TemplatePreviewMode,
} from "@/lib/templates/preview.client";
import {
  PREVIEW_FETCH_TIMEOUT_MS,
  withTimeout,
} from "@/lib/templates/preview-utils";
import type { TemplatePreviewStatus } from "@/components/shared/TemplatePreviewPane";
import type { DocumentVersion } from "../types";

function resolveBodyTemplate(body?: string | null): string {
  if (!body?.trim()) return "";
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { body_template?: string };
      return parsed.body_template?.trim() ?? "";
    } catch {
      return body;
    }
  }
  return body;
}

function hasTemplateTokens(text: string): boolean {
  return /\{\{\s*[\w\-_.]+\s*\}\}/.test(text);
}

function compileTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w\-_.]+)\s*\}\}/g, (_, key: string) =>
    values[key] !== undefined ? values[key] : "",
  );
}

export function useDocumentContentPreview(options: {
  body?: string | null;
  fieldValues?: Record<string, string>;
  currentVersion?: DocumentVersion | null;
}) {
  const { body, fieldValues = {}, currentVersion } = options;

  const [status, setStatus] = useState<TemplatePreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [mode, setMode] = useState<TemplatePreviewMode>("empty");
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);

  const loadVersionRef = useRef(0);
  const fieldValuesKey = useMemo(() => JSON.stringify(fieldValues), [fieldValues]);

  useEffect(() => {
    const loadVersion = ++loadVersionRef.current;
    setError(null);
    setHtml(null);
    setDocxBlob(null);

    const filePath = currentVersion?.file_path;
    const fileFormat = currentVersion?.file_format;

    if (filePath && fileFormat) {
      const nextMode = previewModeForFormat(fileFormat, filePath, "");
      if (nextMode === "unsupported") {
        setMode("unsupported");
        setStatus("ready");
        return;
      }

      setMode(nextMode);
      setStatus("loading");

      (async () => {
        try {
          const { signed_url } = await withTimeout(
            getSignedDownloadUrl({
              data: { bucket: STORAGE_BUCKETS.documents, path: filePath },
            }),
            PREVIEW_FETCH_TIMEOUT_MS,
            "Превышено время ожидания загрузки документа",
          );
          const response = await withTimeout(
            fetch(signed_url),
            PREVIEW_FETCH_TIMEOUT_MS,
            "Превышено время ожидания загрузки файла",
          );
          if (!response.ok) throw new Error("Не удалось загрузить файл документа");
          const blob = await response.blob();
          if (loadVersion !== loadVersionRef.current) return;

          if (nextMode === "docx") {
            setDocxBlob(blob);
            setHtml(null);
          } else if (fileFormat === "xlsx") {
            setHtml(await xlsxBlobToPreviewHtml(blob));
            setDocxBlob(null);
          }
          setStatus("ready");
        } catch (e) {
          if (loadVersion !== loadVersionRef.current) return;
          setError(e instanceof Error ? e.message : "Ошибка загрузки документа");
          setStatus("error");
        }
      })();
      return;
    }

    const template = resolveBodyTemplate(body);
    if (!template.trim()) {
      setMode("empty");
      setStatus("idle");
      return;
    }

    const compiled = hasTemplateTokens(template)
      ? compileTemplate(template, fieldValues)
      : template;

    setMode("html");
    setHtml(DOMPurify.sanitize(compiled));
    setStatus("ready");
  }, [body, currentVersion?.file_path, currentVersion?.file_format, fieldValuesKey]);

  return { status, error, html, mode, docxBlob };
}

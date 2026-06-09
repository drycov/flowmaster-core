import { useEffect, useMemo, useRef, useState } from "react";
import { getSignedDownloadUrl } from "@/lib/api/storage.functions";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import type { TemplateFileFormat } from "@/lib/templates/file-formats";
import {
  buildFilledBodyPreviewHtml,
  previewModeForFormat,
  xlsxBlobToPreviewHtml,
  type TemplatePreviewMode,
} from "@/lib/templates/preview.client";
import { buildPreviewTemplateValues } from "@/lib/templates/preview-values";
import { renderTemplateFileClient } from "@/lib/templates/preview-render.client";
import {
  PREVIEW_FETCH_TIMEOUT_MS,
  PREVIEW_RENDER_TIMEOUT_MS,
  withTimeout,
} from "@/lib/templates/preview-utils";
import type { Template } from "../types";
import type { TemplatePreviewStatus } from "@/components/shared/TemplatePreviewPane";

const PREVIEW_DEBOUNCE_MS = 400;

function getBodyTemplate(template: Template): string {
  const schema = template.schema as { body_template?: string } | null | undefined;
  return schema?.body_template?.trim() ?? "";
}

export function useDocumentPreview(options: {
  template: Template | null | undefined;
  fieldValues: Record<string, string>;
  authorDefaults?: Record<string, string>;
}) {
  const { template, fieldValues, authorDefaults } = options;

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

  const bodyTemplate = template ? getBodyTemplate(template) : "";
  const previewValues = useMemo(() => {
    if (!template) return {};
    return buildPreviewTemplateValues({
      template: {
        name_ru: template.name_ru,
        name_kk: template.name_kk,
        schema: template.schema as {
          title_template_ru?: string;
          title_template_kk?: string;
        } | null,
      },
      fieldValues,
      authorDefaults,
    });
  }, [template, fieldValues, authorDefaults]);

  const valuesKey = useMemo(() => JSON.stringify(previewValues), [previewValues]);

  useEffect(() => {
    if (!template) {
      setMode("empty");
      setStatus("idle");
      setIsRefreshing(false);
      setHtml(null);
      setDocxBlob(null);
      sourceBlobRef.current = null;
      hasRenderedRef.current = false;
      setSourceReady(0);
      return;
    }

    const nextMode = previewModeForFormat(
      template.file_format,
      template.file_path,
      bodyTemplate,
    );
    setMode(nextMode);
    setError(null);
    setHtml(null);
    setDocxBlob(null);
    sourceBlobRef.current = null;
    hasRenderedRef.current = false;
    setSourceReady(0);
    setIsRefreshing(false);

    if (nextMode === "empty" || nextMode === "unsupported") {
      setStatus(nextMode === "unsupported" ? "ready" : "idle");
      return;
    }

    if (nextMode === "html" && !template.file_path) {
      setHtml(buildFilledBodyPreviewHtml(bodyTemplate, previewValues));
      hasRenderedRef.current = true;
      setStatus("ready");
      return;
    }

    if (!template.file_path) {
      setStatus("error");
      setError("Файл шаблона не найден");
      return;
    }

    const loadVersion = ++loadVersionRef.current;
    setStatus("loading");

    (async () => {
      try {
        const { signed_url } = await withTimeout(
          getSignedDownloadUrl({
            data: { bucket: STORAGE_BUCKETS.templates, path: template.file_path! },
          }),
          PREVIEW_FETCH_TIMEOUT_MS,
          "Превышено время ожидания загрузки шаблона",
        );
        const response = await withTimeout(
          fetch(signed_url),
          PREVIEW_FETCH_TIMEOUT_MS,
          "Превышено время ожидания загрузки файла",
        );
        if (!response.ok) throw new Error("Не удалось загрузить файл шаблона");
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
  }, [template?.id, template?.file_path, template?.file_format, bodyTemplate]);

  useEffect(() => {
    if (!template || mode === "empty" || mode === "unsupported") return;

    if (mode === "html" && !template.file_path) {
      const timer = window.setTimeout(() => {
        setHtml(buildFilledBodyPreviewHtml(bodyTemplate, previewValues));
        hasRenderedRef.current = true;
        setStatus("ready");
        setIsRefreshing(false);
      }, PREVIEW_DEBOUNCE_MS);
      return () => window.clearTimeout(timer);
    }

    const sourceBlob = sourceBlobRef.current;
    if (!sourceBlob) return;

    const renderVersion = ++renderVersionRef.current;
    if (hasRenderedRef.current) {
      setIsRefreshing(true);
    } else {
      setStatus("loading");
    }

    const timer = window.setTimeout(async () => {
      try {
        const format = template.file_format as TemplateFileFormat;

        if (mode === "docx") {
          const rendered = await withTimeout(
            renderTemplateFileClient(sourceBlob, format, previewValues),
            PREVIEW_RENDER_TIMEOUT_MS,
            "Превышено время формирования предпросмотра DOCX",
          );
          if (renderVersion !== renderVersionRef.current) return;
          setDocxBlob(rendered);
          setHtml(null);
          hasRenderedRef.current = true;
          setStatus("ready");
          setIsRefreshing(false);
          return;
        }

        if (mode === "html" && format === "xlsx") {
          const rendered = await withTimeout(
            renderTemplateFileClient(sourceBlob, format, previewValues),
            PREVIEW_RENDER_TIMEOUT_MS,
            "Превышено время формирования предпросмотра XLSX",
          );
          if (renderVersion !== renderVersionRef.current) return;
          setHtml(
            await withTimeout(
              xlsxBlobToPreviewHtml(rendered),
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
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [template, mode, bodyTemplate, valuesKey, sourceReady]);

  return {
    status,
    isRefreshing,
    error,
    html,
    mode,
    docxBlob,
  };
}

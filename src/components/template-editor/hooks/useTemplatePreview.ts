import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSignedDownloadUrl } from "@/lib/api/storage.functions";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import type { TemplateFileFormat } from "@/lib/templates/file-formats";
import {
  buildBodyPreviewHtml,
  previewModeForFormat,
  xlsxBlobToPreviewHtml,
  type TemplatePreviewMode,
} from "@/lib/templates/preview.client";
import { buildTemplateEditorPreviewValues } from "@/lib/templates/preview-values";
import { renderTemplateFileClient } from "@/lib/templates/preview-render.client";
import {
  PREVIEW_FETCH_TIMEOUT_MS,
  PREVIEW_RENDER_TIMEOUT_MS,
  withTimeout,
} from "@/lib/templates/preview-utils";
import type { TemplatePreviewStatus } from "@/components/shared/TemplatePreviewPane";
import type { Field } from "../types";

const PREVIEW_DEBOUNCE_MS = 400;

type PreviewStatus = TemplatePreviewStatus;

export function useTemplatePreview(options: {
  filePath: string | null;
  fileFormat: string | null;
  body: string;
  fields: Field[];
  nameRu?: string;
  nameKk?: string;
}) {
  const { filePath, fileFormat, body, fields, nameRu, nameKk } = options;

  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [mode, setMode] = useState<TemplatePreviewMode>("empty");
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const sourceBlobRef = useRef<Blob | null>(null);
  const loadVersionRef = useRef(0);
  const renderVersionRef = useRef(0);
  const hasRenderedRef = useRef(false);
  const [sourceReady, setSourceReady] = useState(0);

  const previewValues = useMemo(
    () =>
      buildTemplateEditorPreviewValues(fields, {
        name_ru: nameRu,
        name_kk: nameKk,
      }),
    [fields, nameRu, nameKk],
  );

  const valuesKey = useMemo(() => JSON.stringify(previewValues), [previewValues]);
  const bodyKey = body;
  const fieldsKey = useMemo(
    () => JSON.stringify(fields.map((f) => ({ key: f.key, label_ru: f.label_ru }))),
    [fields],
  );

  useEffect(() => {
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
      setError("Файл шаблона не найден");
      return;
    }

    const loadVersion = ++loadVersionRef.current;
    setStatus("loading");

    (async () => {
      try {
        const { signed_url } = await withTimeout(
          getSignedDownloadUrl({
            data: { bucket: STORAGE_BUCKETS.templates, path: filePath },
          }),
          PREVIEW_FETCH_TIMEOUT_MS,
          "Превышено время ожидания загрузки шаблона",
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
  }, [filePath, fileFormat, body, reloadToken]);

  useEffect(() => {
    if (mode === "empty" || mode === "unsupported") return;

    const renderVersion = ++renderVersionRef.current;

    if (mode === "html" && !filePath) {
      if (hasRenderedRef.current) {
        setIsRefreshing(true);
      } else {
        setStatus("loading");
      }
      const timer = window.setTimeout(() => {
        if (renderVersion !== renderVersionRef.current) return;
        setHtml(buildBodyPreviewHtml(body, fields));
        hasRenderedRef.current = true;
        setStatus("ready");
        setIsRefreshing(false);
      }, PREVIEW_DEBOUNCE_MS);
      return () => window.clearTimeout(timer);
    }

    const sourceBlob = sourceBlobRef.current;
    if (!sourceBlob || !fileFormat) return;

    if (hasRenderedRef.current) {
      setIsRefreshing(true);
    } else {
      setStatus("loading");
    }

    const timer = window.setTimeout(async () => {
      try {
        const format = fileFormat as TemplateFileFormat;

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
  }, [mode, filePath, fileFormat, bodyKey, fieldsKey, valuesKey, sourceReady]);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return {
    status,
    isRefreshing,
    error,
    html,
    mode,
    docxBlob,
    reload,
  };
}

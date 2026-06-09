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
import type { TemplatePreviewStatus } from "@/components/shared/TemplatePreviewPane";
import type { Field } from "../types";

const PREVIEW_DEBOUNCE_MS = 300;

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
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [mode, setMode] = useState<TemplatePreviewMode>("empty");
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const sourceBlobRef = useRef<Blob | null>(null);
  const loadVersionRef = useRef(0);
  const renderVersionRef = useRef(0);
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
    setSourceReady(0);

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
        const { signed_url } = await getSignedDownloadUrl({
          data: { bucket: STORAGE_BUCKETS.templates, path: filePath },
        });
        const response = await fetch(signed_url);
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
      setStatus("loading");
      const timer = window.setTimeout(() => {
        if (renderVersion !== renderVersionRef.current) return;
        setHtml(buildBodyPreviewHtml(body, fields));
        setStatus("ready");
      }, PREVIEW_DEBOUNCE_MS);
      return () => window.clearTimeout(timer);
    }

    const sourceBlob = sourceBlobRef.current;
    if (!sourceBlob || !fileFormat) return;

    setStatus("loading");

    const timer = window.setTimeout(async () => {
      try {
        const format = fileFormat as TemplateFileFormat;

        if (mode === "docx") {
          const rendered = await renderTemplateFileClient(sourceBlob, format, previewValues);
          if (renderVersion !== renderVersionRef.current) return;
          setDocxBlob(rendered);
          setHtml(null);
          setStatus("ready");
          return;
        }

        if (mode === "html" && format === "xlsx") {
          const rendered = await renderTemplateFileClient(sourceBlob, format, previewValues);
          if (renderVersion !== renderVersionRef.current) return;
          setHtml(await xlsxBlobToPreviewHtml(rendered));
          setDocxBlob(null);
          setStatus("ready");
        }
      } catch (e) {
        if (renderVersion !== renderVersionRef.current) return;
        setError(e instanceof Error ? e.message : "Ошибка предпросмотра");
        setStatus("error");
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [mode, filePath, fileFormat, bodyKey, fieldsKey, valuesKey, previewValues, sourceReady]);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return {
    status,
    error,
    html,
    mode,
    docxBlob,
    reload,
  };
}

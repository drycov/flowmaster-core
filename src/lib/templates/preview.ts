import { createIsomorphicFn } from "@tanstack/react-start";

export type TemplatePreviewMode = "docx" | "html" | "unsupported" | "empty";

export type TemplateFieldLabel = {
  key: string;
  label_ru: string;
};

export const buildFilledBodyPreviewHtml = createIsomorphicFn()
  .server(async () => "")
  .client(async (body: string, values: Record<string, string>) => {
    const { buildFilledBodyPreviewHtml: impl } = await import("./preview.client");
    return impl(body, values);
  });

export const buildBodyPreviewHtml = createIsomorphicFn()
  .server(async () => "")
  .client(async (body: string, fields: TemplateFieldLabel[]) => {
    const { buildBodyPreviewHtml: impl } = await import("./preview.client");
    return impl(body, fields);
  });

export const xlsxBlobToPreviewHtml = createIsomorphicFn()
  .server(async () => "")
  .client(async (blob: Blob) => {
    const { xlsxBlobToPreviewHtml: impl } = await import("./preview.client");
    return impl(blob);
  });

export const renderDocxPreview = createIsomorphicFn()
  .server(async () => {})
  .client(
    async (
      blob: Blob,
      bodyContainer: HTMLElement,
      styleContainer?: HTMLElement | null,
    ) => {
      const { renderDocxPreview: impl } = await import("./preview.client");
      return impl(blob, bodyContainer, styleContainer);
    },
  );

export function previewModeForFormat(
  fileFormat: string | null | undefined,
  filePath: string | null | undefined,
  body: string,
): TemplatePreviewMode {
  if (filePath && fileFormat === "docx") return "docx";
  if (filePath && fileFormat === "xlsx") return "html";
  if (filePath && fileFormat) return "unsupported";
  if (body.trim()) return "html";
  return "empty";
}

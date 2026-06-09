import { createIsomorphicFn } from "@tanstack/react-start";
import type { TemplateFileFormat } from "./file-formats";

export const renderTemplateFileClient = createIsomorphicFn()
  .server(async () => new Blob())
  .client(
    async (
      templateBlob: Blob,
      format: TemplateFileFormat,
      values: Record<string, string>,
    ) => {
      const { renderTemplateFileClient: impl } = await import("./preview-render.client");
      return impl(templateBlob, format, values);
    },
  );

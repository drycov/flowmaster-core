import ExcelJS from "exceljs";
import DOMPurify from "dompurify";
import { renderAsync } from "docx-preview";
import { applyDocxBackgroundLayers, extractDocxBackgroundImages } from "./docx-background.client";
import { replaceDocxVectorImages } from "./docx-vector-images.client";
import { PLACEHOLDER_PATTERN } from "./file-formats";
import type { TemplateFieldLabel } from "./preview";

export type { TemplatePreviewMode, TemplateFieldLabel } from "./preview";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightPlaceholders(text: string): string {
  return escapeHtml(text).replace(
    PLACEHOLDER_PATTERN,
    '<mark class="rounded bg-amber-100 px-1 font-mono text-xs text-amber-900">$&</mark>',
  );
}

export function buildFilledBodyPreviewHtml(body: string, values: Record<string, string>): string {
  let html = body;
  for (const [key, value] of Object.entries(values)) {
    html = html.split(`{{${key}}}`).join(escapeHtml(value ?? ""));
  }
  html = html.replace(/\{\{[^}]+\}\}/g, "");
  return DOMPurify.sanitize(html);
}

export function buildBodyPreviewHtml(body: string, fields: TemplateFieldLabel[]): string {
  let html = body;
  for (const field of fields) {
    const token = `{{${field.key}}}`;
    const sample = `<mark class="rounded bg-amber-100 px-1 text-amber-900">${escapeHtml(field.label_ru)}</mark>`;
    html = html.split(token).join(sample);
  }
  return DOMPurify.sanitize(html);
}

export async function xlsxBlobToPreviewHtml(blob: Blob): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return '<p class="text-sm text-muted-foreground">Пустая таблица</p>';
  }

  const maxCols = Math.min(sheet.columnCount || 1, 12);
  const rows: string[] = [
    '<div class="overflow-x-auto"><table class="w-full border-collapse text-sm">',
  ];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 40) return;
    const isHeader = rowNumber === 1;
    rows.push("<tr>");
    for (let col = 1; col <= maxCols; col++) {
      const cell = row.getCell(col);
      const raw = String(cell.text ?? "");
      const tag = isHeader ? "th" : "td";
      const cellClass = isHeader
        ? "border bg-muted/50 px-2 py-1.5 text-left font-medium"
        : "border px-2 py-1.5 align-top";
      rows.push(`<${tag} class="${cellClass}">${highlightPlaceholders(raw)}</${tag}>`);
    }
    rows.push("</tr>");
  });

  rows.push("</table></div>");
  if (sheet.rowCount > 40) {
    rows.push('<p class="mt-2 text-xs text-muted-foreground">Показаны первые 40 строк</p>');
  }

  return DOMPurify.sanitize(rows.join(""));
}

export async function renderDocxPreview(
  blob: Blob,
  bodyContainer: HTMLElement,
  styleContainer?: HTMLElement | null,
): Promise<void> {
  bodyContainer.innerHTML = "";
  if (styleContainer) styleContainer.innerHTML = "";

  const previewBlob = await replaceDocxVectorImages(blob);

  const [backgrounds] = await Promise.all([
    extractDocxBackgroundImages(previewBlob),
    renderAsync(previewBlob, bodyContainer, styleContainer ?? undefined, {
      className: "docx-preview",
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      breakPages: true,
      useBase64URL: true,
      experimental: true,
    }),
  ]);

  applyDocxBackgroundLayers(bodyContainer, backgrounds);
  hideBrokenDocxImages(bodyContainer);
}

function hideBrokenDocxImages(container: HTMLElement): void {
  container.querySelectorAll("img").forEach((node) => {
    const img = node as HTMLImageElement;
    const hide = () => {
      img.style.display = "none";
    };
    img.addEventListener("error", hide, { once: true });
    if (img.complete && img.naturalWidth === 0) hide();
  });
}

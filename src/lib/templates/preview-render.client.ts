import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import type { TemplateFileFormat } from "./file-formats";

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result != null) return String(value.result);
  }
  return String(value);
}

function replacePlaceholdersInText(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([a-zA-Z0-9_\u0400-\u04FF]+)\}\}/g, (_, key: string) =>
    values[key] != null ? String(values[key]) : "",
  );
}

export async function renderDocxTemplateClient(
  templateBlob: Blob,
  values: Record<string, string>,
): Promise<Blob> {
  const zip = new PizZip(await templateBlob.arrayBuffer());
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(values);
  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }) as Blob;
}

export async function renderXlsxTemplateClient(
  templateBlob: Blob,
  values: Record<string, string>,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await templateBlob.arrayBuffer());
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const raw = cellText(cell.value);
        if (!raw.includes("{{")) return;
        cell.value = replacePlaceholdersInText(raw, values);
      });
    });
  });
  const out = await workbook.xlsx.writeBuffer();
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function renderTemplateFileClient(
  templateBlob: Blob,
  format: TemplateFileFormat,
  values: Record<string, string>,
): Promise<Blob> {
  if (format === "docx") return renderDocxTemplateClient(templateBlob, values);
  if (format === "xlsx") return renderXlsxTemplateClient(templateBlob, values);
  throw new Error(`Preview not supported for format: ${format}`);
}

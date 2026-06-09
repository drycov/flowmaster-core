import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  extractPlaceholderKeys,
  type TemplateFileFormat,
  supportsTemplateProcessing,
} from "./file-formats";

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((p) => p.text ?? "").join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result != null) return String(value.result);
  }
  return String(value);
}

function replacePlaceholdersInText(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([a-zA-Z0-9_\u0400-\u04FF]+)\}\}/g, (_, key: string) =>
    values[key] != null ? String(values[key]) : `{{${key}}}`,
  );
}

/** Concatenate DOCX XML text nodes so split placeholders become searchable. */
function docxXmlToPlainText(xml: string): string {
  return xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "");
}

export async function scanTemplatePlaceholders(
  buffer: Buffer,
  format: TemplateFileFormat,
): Promise<string[]> {
  if (!supportsTemplateProcessing(format)) {
    return [];
  }

  if (format === "docx") {
    const zip = new PizZip(buffer);
    const xmlParts = Object.keys(zip.files).filter(
      (name) =>
        name === "word/document.xml" ||
        name.startsWith("word/header") ||
        name.startsWith("word/footer"),
    );
    let combinedXml = "";
    for (const part of xmlParts) {
      const file = zip.file(part);
      if (!file) continue;
      combinedXml += file.asText();
    }
    // Word often splits {{key}} across multiple <w:t> runs — strip tags to reunite text.
    const plain = docxXmlToPlainText(combinedXml);
    return extractPlaceholderKeys(plain);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const keys = new Set<string>();
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        extractPlaceholderKeys(cellText(cell.value)).forEach((k) => keys.add(k));
      });
    });
  });
  return [...keys].sort();
}

export async function renderTemplateFile(
  buffer: Buffer,
  format: TemplateFileFormat,
  values: Record<string, string>,
): Promise<Buffer> {
  if (format === "docx") {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
      nullGetter: () => "",
    });
    doc.render(values);
    return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  }

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
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
    return Buffer.from(out);
  }

  throw new Error(`Формат ${format} не поддерживается для автозаполнения. Используйте DOCX или XLSX.`);
}

export async function downloadTemplateBuffer(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.templates)
    .download(storagePath);
  if (error || !data) throw new Error("Файл шаблона не найден в хранилище");
  return Buffer.from(await data.arrayBuffer());
}

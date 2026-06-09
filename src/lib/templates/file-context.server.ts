import ExcelJS from "exceljs";
import PizZip from "pizzip";
import { PLACEHOLDER_PATTERN, type TemplateFileFormat } from "./file-formats";
import { humanizeFilename, inferCategoryFromTitle } from "./field-inference";

export type TemplateFileContext = {
  title: string;
  description: string;
  category: string | null;
};

function docxXmlToPlainText(xml: string): string {
  return xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "");
}

function stripPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_PATTERN, "").replace(/\s+/g, " ").trim();
}

function extractDocxPlainText(buffer: Buffer): string {
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
  return docxXmlToPlainText(combinedXml);
}

function buildDescription(lines: string[], title: string): string {
  const body = lines
    .slice(1, 5)
    .map(stripPlaceholders)
    .filter((l) => l.length > 10)
    .join(" ");

  if (body.length >= 20) {
    return body.length > 500 ? `${body.slice(0, 497)}…` : body;
  }
  return `Шаблон документа «${title}». Заполните поля при создании документа.`;
}

export async function extractTemplateFileContext(
  buffer: Buffer,
  format: TemplateFileFormat,
  filePath?: string | null,
): Promise<TemplateFileContext> {
  const filename = filePath?.split("/").pop() ?? "";
  const nameFromFile = humanizeFilename(filename);

  if (format === "docx") {
    const plain = extractDocxPlainText(buffer);
    const lines = plain
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const meaningful = lines
      .map(stripPlaceholders)
      .filter((l) => l.length > 2);

    const title = meaningful[0] || nameFromFile || "Шаблон документа";
    const description = buildDescription(meaningful, title);
    const category = inferCategoryFromTitle(title);

    return { title, description, category };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const firstSheet = workbook.worksheets[0];
  const sheetTitle = firstSheet?.name?.trim() || nameFromFile || "Таблица";
  const title = nameFromFile || sheetTitle;

  let preview = "";
  if (firstSheet) {
    const parts: string[] = [];
    firstSheet.eachRow((row, rowNo) => {
      if (rowNo > 6) return;
      const cells: string[] = [];
      row.eachCell((cell) => {
        const t = stripPlaceholders(String(cell.text ?? ""));
        if (t) cells.push(t);
      });
      if (cells.length) parts.push(cells.join(" — "));
    });
    preview = parts.join(". ");
  }

  const description =
    preview.length > 20
      ? preview.length > 500
        ? `${preview.slice(0, 497)}…`
        : preview
      : `Шаблон таблицы «${title}». Лист: ${sheetTitle}.`;

  return {
    title,
    description,
    category: inferCategoryFromTitle(title),
  };
}

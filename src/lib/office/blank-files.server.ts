import PizZip from "pizzip";
import ExcelJS from "exceljs";
import { templateMimeType, type TemplateFileFormat } from "@/lib/templates/file-formats";

export async function createBlankOfficeFile(format: "docx" | "xlsx"): Promise<Buffer> {
  if (format === "docx") return createBlankDocx();
  return createBlankXlsx();
}

function createBlankDocx(): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t></w:t></w:r></w:p></w:body>
</w:document>`,
  );
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}

async function createBlankXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Sheet1");
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function blankOfficeMimeType(format: "docx" | "xlsx"): string {
  return templateMimeType(format as TemplateFileFormat);
}

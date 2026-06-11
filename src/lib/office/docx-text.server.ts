import PizZip from "pizzip";

function docxXmlToPlainText(xml: string): string {
  return xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "");
}

/** Extract plain text from a DOCX buffer (word + headers + footers). */
export function extractDocxPlainText(buffer: Buffer): string {
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
  return docxXmlToPlainText(combinedXml).trim();
}

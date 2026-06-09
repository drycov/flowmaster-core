import PizZip from "pizzip";

export type DocxBackgroundLayer = {
  dataUrl: string;
};

function parseRels(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(relsXml))) {
    map.set(match[1], match[2]);
  }
  return map;
}

function resolveMediaPath(target: string): string {
  const normalized = target.replace(/^\//, "");
  if (normalized.startsWith("word/")) return normalized;
  return `word/${normalized}`;
}

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "emf") return "image/x-emf";
  if (ext === "wmf") return "image/x-wmf";
  return "image/png";
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function isBackgroundContext(xml: string, index: number): boolean {
  const slice = xml.slice(Math.max(0, index - 1200), index + 400);
  if (/behindDoc="(?:1|true)"/i.test(slice)) return true;
  if (/<w:background\b/i.test(slice)) return true;
  if (/<v:shape[^>]*style="[^"]*z-index:\s*-\d+/i.test(slice)) return true;
  if (/<v:shape[^>]*style="[^"]*position:\s*absolute/i.test(slice)) return true;
  return false;
}

function addImageFromRels(
  zip: PizZip,
  rels: Map<string, string>,
  rId: string,
  seen: Set<string>,
  out: DocxBackgroundLayer[],
) {
  const target = rels.get(rId);
  if (!target) return;
  const path = resolveMediaPath(target);
  if (seen.has(path)) return;
  const file = zip.file(path);
  if (!file) return;
  seen.add(path);
  const bytes = file.asUint8Array();
  const mime = mimeFromPath(path);
  out.push({ dataUrl: `data:${mime};base64,${uint8ToBase64(bytes)}` });
}

/**
 * docx-preview ignores behindDoc anchors — extract watermark/background images manually.
 */
export async function extractDocxBackgroundImages(blob: Blob): Promise<DocxBackgroundLayer[]> {
  const zip = new PizZip(await blob.arrayBuffer());
  const results: DocxBackgroundLayer[] = [];
  const seen = new Set<string>();

  const xmlParts = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d+|footer\d+)\.xml$/.test(name),
  );

  for (const partPath of xmlParts) {
    const xml = zip.file(partPath)?.asText();
    if (!xml) continue;
    const isHeaderPart = /^word\/header\d+\.xml$/.test(partPath);

    const relsPath = partPath.replace("word/", "word/_rels/") + ".rels";
    const rels = parseRels(zip.file(relsPath)?.asText() ?? "");

    const patterns = [/r:embed="(rId\d+)"/g, /r:id="(rId\d+)"/g, /o:relid="(rId\d+)"/gi];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(xml))) {
        if (!isHeaderPart && !isBackgroundContext(xml, match.index)) continue;
        addImageFromRels(zip, rels, match[1], seen, results);
      }
    }
  }

  // Fallback: VML / pict watermarks in headers without explicit behindDoc flag
  if (results.length === 0) {
    const headerParts = xmlParts.filter((p) => p.startsWith("word/header"));
    for (const partPath of headerParts) {
      const xml = zip.file(partPath)?.asText() ?? "";
      if (!/<v:shape|<w:pict|<v:imagedata/i.test(xml)) continue;
      const relsPath = partPath.replace("word/", "word/_rels/") + ".rels";
      const rels = parseRels(zip.file(relsPath)?.asText() ?? "");
      for (const rId of rels.keys()) {
        addImageFromRels(zip, rels, rId, seen, results);
      }
      if (results.length > 0) break;
    }
  }

  return results;
}

export function applyDocxBackgroundLayers(
  bodyContainer: HTMLElement,
  layers: DocxBackgroundLayer[],
): void {
  if (layers.length === 0) return;

  const wrappers = bodyContainer.querySelectorAll("section.docx-wrapper, .docx-wrapper");
  const targets =
    wrappers.length > 0 ? Array.from(wrappers) : [bodyContainer.firstElementChild ?? bodyContainer];

  targets.forEach((target, index) => {
    const layer = layers[index] ?? layers[0];
    if (!layer) return;

    const el = target as HTMLElement;
    el.querySelectorAll(".docx-bg-layer").forEach((node) => node.remove());

    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }

    const bg = document.createElement("div");
    bg.className = "docx-bg-layer";
    bg.setAttribute("aria-hidden", "true");
    bg.style.backgroundImage = `url("${layer.dataUrl}")`;
    el.insertBefore(bg, el.firstChild);

    Array.from(el.children).forEach((child, childIndex) => {
      if (childIndex === 0) return;
      const childEl = child as HTMLElement;
      if (getComputedStyle(childEl).position === "static") {
        childEl.style.position = "relative";
      }
      childEl.style.zIndex = "1";
    });
  });
}

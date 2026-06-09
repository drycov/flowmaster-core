import PizZip from "pizzip";

type VectorFormat = "emf" | "wmf";

type VectorRendererModule = {
  Renderer: new (blob: ArrayBuffer) => {
    render: (info: {
      width: string;
      height: string;
      wExt: number;
      hExt: number;
      xExt: number;
      yExt: number;
      mapMode: number;
    }) => SVGElement;
  };
  loggingEnabled: (enabled: boolean) => void;
  Error?: new (message: string) => Error;
};

let emfModule: VectorRendererModule | null = null;
let wmfModule: VectorRendererModule | null = null;

async function getEmfRenderer(): Promise<VectorRendererModule> {
  if (!emfModule) {
    const mod = await import("rtf.js/dist/EMFJS.bundle.js");
    emfModule = (mod.default ?? mod) as VectorRendererModule;
    emfModule.loggingEnabled(false);
  }
  return emfModule;
}

async function getWmfRenderer(): Promise<VectorRendererModule> {
  if (!wmfModule) {
    const mod = await import("rtf.js/dist/WMFJS.bundle.js");
    wmfModule = (mod.default ?? mod) as VectorRendererModule;
    wmfModule.loggingEnabled(false);
  }
  return wmfModule;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function parseEmfExtents(buffer: ArrayBuffer): { wExt: number; hExt: number } {
  const view = new DataView(buffer);
  const left = view.getInt32(8, true);
  const top = view.getInt32(12, true);
  const right = view.getInt32(16, true);
  const bottom = view.getInt32(20, true);
  return {
    wExt: Math.max(1, right - left),
    hExt: Math.max(1, bottom - top),
  };
}

function parseWmfExtents(buffer: ArrayBuffer): { wExt: number; hExt: number } {
  const view = new DataView(buffer);
  if (buffer.byteLength < 18) return { wExt: 1000, hExt: 1000 };
  const width = view.getInt16(10, true);
  const height = view.getInt16(12, true);
  if (width > 0 && height > 0) return { wExt: width, hExt: height };
  return { wExt: 1000, hExt: 1000 };
}

function capDimension(value: number, max = 4096): number {
  return Math.min(max, Math.max(1, Math.ceil(value)));
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load rendered vector image"));
    img.src = url;
  });
}

async function svgElementToPngBytes(
  svg: SVGElement,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const w = capDimension(width);
  const h = capDimension(height);
  const svgText = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const img = await loadImageElement(url);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.drawImage(img, 0, 0, w, h);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode PNG"));
      }, "image/png");
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function convertVectorMediaToPng(
  bytes: Uint8Array,
  format: VectorFormat,
): Promise<Uint8Array> {
  const buffer = toArrayBuffer(bytes);
  const extents = format === "emf" ? parseEmfExtents(buffer) : parseWmfExtents(buffer);
  const rendererModule = format === "emf" ? await getEmfRenderer() : await getWmfRenderer();
  const renderer = new rendererModule.Renderer(buffer);
  const svg = renderer.render({
    width: `${extents.wExt}px`,
    height: `${extents.hExt}px`,
    wExt: extents.wExt,
    hExt: extents.hExt,
    xExt: extents.wExt,
    yExt: extents.hExt,
    mapMode: 8,
  });
  return svgElementToPngBytes(svg, extents.wExt, extents.hExt);
}

function replaceTargetsInXml(xml: string, replacements: Map<string, string>): string {
  let next = xml;
  for (const [oldTarget, newTarget] of replacements) {
    next = next.split(oldTarget).join(newTarget);
  }
  return next;
}

/**
 * Browsers cannot render EMF/WMF from DOCX media. Convert them to PNG in-place before docx-preview.
 */
export async function replaceDocxVectorImages(blob: Blob): Promise<Blob> {
  const zip = new PizZip(await blob.arrayBuffer());
  const targetReplacements = new Map<string, string>();
  let converted = 0;

  for (const path of Object.keys(zip.files)) {
    const lower = path.toLowerCase();
    const emfMatch = lower.match(/^word\/media\/(.+)\.emf$/);
    const wmfMatch = lower.match(/^word\/media\/(.+)\.wmf$/);
    const match = emfMatch ?? wmfMatch;
    if (!match || zip.files[path].dir) continue;

    const format: VectorFormat = emfMatch ? "emf" : "wmf";
    const pngPath = `word/media/${match[1]}.png`;
    const bytes = zip.file(path)?.asUint8Array();
    if (!bytes) continue;

    try {
      const pngBytes = await convertVectorMediaToPng(bytes, format);
      zip.file(pngPath, pngBytes);
      zip.remove(path);
      targetReplacements.set(`media/${match[1]}.${format}`, `media/${match[1]}.png`);
      converted += 1;
    } catch (error) {
      console.warn(`DOCX preview: failed to convert ${path}`, error);
    }
  }

  if (converted === 0) return blob;

  for (const relsPath of Object.keys(zip.files).filter((name) => name.endsWith(".rels"))) {
    const xml = zip.file(relsPath)?.asText();
    if (!xml) continue;
    const updated = replaceTargetsInXml(xml, targetReplacements);
    if (updated !== xml) zip.file(relsPath, updated);
  }

  return zip.generate({
    type: "blob",
    mimeType:
      blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }) as Blob;
}

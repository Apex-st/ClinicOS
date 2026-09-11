import { PDFDocument, type PDFFont } from "pdf-lib";
import fontkitMod from "@pdf-lib/fontkit";

const cache = new Map<string, ArrayBuffer>();

function resolveFontkit() {
  const mod = fontkitMod as unknown as { default?: typeof fontkitMod };
  return (mod.default ?? fontkitMod) as Parameters<PDFDocument["registerFontkit"]>[0];
}

async function fetchFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return buf.byteLength > 1000 ? buf : null;
  } catch {
    return null;
  }
}

export async function loadPdfFontBytes(file: string): Promise<ArrayBuffer> {
  const hit = cache.get(file);
  if (hit) return hit;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const baseUri = typeof document !== "undefined" ? document.baseURI : origin;
  const viteBase = typeof import.meta !== "undefined" ? String(import.meta.env.BASE_URL || "/") : "/";
  const fromBase = `${viteBase.endsWith("/") ? viteBase : `${viteBase}/`}fonts/${file}`;
  const urls = [
    fromBase,
    `/fonts/${file}`,
    origin ? `${origin}/fonts/${file}` : "",
    baseUri ? new URL(`fonts/${file}`, baseUri).href : "",
    `./fonts/${file}`,
    `fonts/${file}`,
  ].filter(Boolean);
  let last = "";
  for (const url of [...new Set(urls)]) {
    const buf = await fetchFont(url);
    if (buf) {
      cache.set(file, buf);
      return buf;
    }
    last = url;
  }
  throw new Error(`Не удалось загрузить шрифт ${file}${last ? `: ${last}` : ""}`);
}

export async function embedPdfFonts(doc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  doc.registerFontkit(resolveFontkit());
  const [reg, bold] = await Promise.all([
    loadPdfFontBytes("NotoSans-Regular.ttf"),
    loadPdfFontBytes("NotoSans-Bold.ttf"),
  ]);
  return {
    regular: await doc.embedFont(reg, { subset: true }),
    bold: await doc.embedFont(bold, { subset: true }),
  };
}

export function pdfBlobFromBytes(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}

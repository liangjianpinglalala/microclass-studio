/**
 * 文件文字提取：PPTX（jszip 解包读幻灯片 XML）+ PDF（pdfjs-dist 文字层）。
 * 原则：提取不到文字就明确报错，绝不编造内容。
 */
import JSZip from "jszip";
// 注意：esbuild 生产构建的 banner 已声明过 createRequire，这里必须改名避免重复声明
import { createRequire as nodeCreateRequire } from "node:module";
import path from "node:path";

// pdfjs-dist 自带的 CMap 文件目录：解码 Adobe-GB1/GBK 等 CID 字体（中文 PDF 常见）所必需
function resolveCMapUrl(): string {
  const req = nodeCreateRequire(import.meta.url);
  const pkgPath = req.resolve("pdfjs-dist/package.json");
  return path.join(path.dirname(pkgPath), "cmaps") + path.sep;
}

export class ExtractError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 422 = 422,
  ) {
    super(message);
  }
}

export interface ExtractResult {
  text: string;
  fileType: "pptx" | "pdf";
  pages: number;
  chars: number;
}

const MIN_CHARS = 20; // 低于此字数视为无可提取文字

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** 从幻灯片 XML 中提取 <a:t> 文本，按段落聚合 */
function extractSlideText(xml: string): string {
  const paragraphs: string[] = [];
  const paraRegex = /<a:p[ >][\s\S]*?<\/a:p>/g;
  const tRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
  let pm: RegExpExecArray | null;
  while ((pm = paraRegex.exec(xml)) !== null) {
    const runs: string[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = tRegex.exec(pm[0])) !== null) {
      runs.push(decodeXmlEntities(tm[1]));
    }
    const line = runs.join("").trim();
    if (line) paragraphs.push(line);
  }
  return paragraphs.join(" ");
}

async function extractPptx(buf: ArrayBuffer): Promise<ExtractResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new ExtractError("文件解析失败：这不是一个有效的 PPTX 文件（可能已损坏或实为其他格式）。", 400);
  }
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1]);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1]);
      return na - nb;
    });
  if (slideNames.length === 0) {
    throw new ExtractError("该 PPTX 中没有找到任何幻灯片页面。", 422);
  }
  const parts: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const text = extractSlideText(xml);
    if (text) parts.push(text);
  }
  const text = parts.join("\n").trim();
  if (text.length < MIN_CHARS) {
    throw new ExtractError(
      "无法从该 PPTX 中提取到足够的文字：页面可能全部是图片。请上传含文字的课件，或改用粘贴文字。",
      422,
    );
  }
  return { text, fileType: "pptx", pages: slideNames.length, chars: text.length };
}

async function extractPdf(buf: ArrayBuffer): Promise<ExtractResult> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (e) {
    throw new ExtractError(`PDF 解析组件加载失败：${String(e)}`, 500 as 422);
  }
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      cMapUrl: resolveCMapUrl(),
      cMapPacked: true,
    }).promise;
  } catch {
    throw new ExtractError("文件解析失败：这不是一个有效的 PDF 文件（可能已损坏或已加密）。", 400);
  }
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join("")
      .trim();
    if (line) parts.push(line);
  }
  const text = parts.join("\n").trim();
  if (text.length < MIN_CHARS) {
    throw new ExtractError(
      "无法从该 PDF 中提取到文字：它可能是扫描件或纯图片型 PDF（没有文字层）。请上传文字型 PDF，或改用粘贴文字。",
      422,
    );
  }
  return { text, fileType: "pdf", pages: doc.numPages, chars: text.length };
}

export async function extractFile(
  buf: ArrayBuffer,
  fileName: string,
): Promise<ExtractResult> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pptx")) return extractPptx(buf);
  if (lower.endsWith(".pdf")) return extractPdf(buf);
  throw new ExtractError("仅支持 .pptx 和 .pdf 格式的文件。", 400);
}

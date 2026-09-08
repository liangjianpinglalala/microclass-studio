/**
 * 教学画面渲染 —— Canvas 2D 程序绘制（1280x720 PNG）
 * 版式：米白纸底 + 徽章 + 大标题 + 要点列表 + 品牌条 + 可选字幕条
 */
import { sectionColor, type ScriptSection } from "./lesson";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

export interface SlideImage {
  /** 干净画面（无字幕条）的 dataURL，供结果区画廊展示 */
  dataURL: string;
  /** 画布位图，供字幕帧合成时直接绘制 */
  bitmap: ImageBitmap;
  sectionIndex: number;
  label: string;
}

/** 确保绘制所需字体就绪 */
export async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('700 52px "Noto Serif SC"'),
      document.fonts.load('900 52px "Noto Serif SC"'),
      document.fonts.load('400 30px "Noto Sans SC"'),
      document.fonts.load('700 30px "Noto Sans SC"'),
      document.fonts.load('400 20px "IBM Plex Mono"'),
    ]);
    await document.fonts.ready;
  } catch {
    // 字体加载失败时退化为系统字体，不阻断流程
  }
}

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 Canvas 2D 上下文");
  return [canvas, ctx];
}

/** 按像素宽度对中英文混合文本自动换行 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 米白纸底 + 极淡网格纸纹 */
function drawPaperBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#FAF6F0";
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

  // 极淡网格线
  ctx.strokeStyle = "rgba(46, 42, 38, 0.035)";
  ctx.lineWidth = 1;
  const gap = 48;
  ctx.beginPath();
  for (let x = gap; x < SLIDE_W; x += gap) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, SLIDE_H);
  }
  for (let y = gap; y < SLIDE_H; y += gap) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(SLIDE_W, y + 0.5);
  }
  ctx.stroke();

  // 稀疏纤维噪点（确定性伪随机，保证同一张画面干净稳定）
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  ctx.fillStyle = "rgba(46, 42, 38, 0.05)";
  for (let i = 0; i < 240; i++) {
    const x = rand() * SLIDE_W;
    const y = rand() * SLIDE_H;
    const r = rand() * 1.4 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 左上角圆角徽章：部分标签 */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  label: string,
  color: string,
): void {
  const padX = 20;
  ctx.font = '700 26px "Noto Sans SC", "PingFang SC", sans-serif';
  const textW = ctx.measureText(label).width;
  const w = textW + padX * 2;
  const h = 50;
  const x = 72;
  const y = 60;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, 25);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(label, x + padX, y + h / 2 + 1);
}

/** 顶部大标题（最多两行，超出自动缩小） */
function drawTitle(ctx: CanvasRenderingContext2D, title: string): number {
  const maxWidth = SLIDE_W - 72 * 2;
  let fontSize = 52;
  let lines: string[] = [];
  for (; fontSize >= 38; fontSize -= 2) {
    ctx.font = `900 ${fontSize}px "Noto Serif SC", "Songti SC", serif`;
    lines = wrapText(ctx, title, maxWidth);
    if (lines.length <= 2) break;
  }
  if (lines.length > 2) lines = [lines[0], lines[1].slice(0, -1) + "…"];

  ctx.fillStyle = "#2B2622";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const lineHeight = fontSize * 1.35;
  const startY = 138;
  lines.forEach((line, i) => {
    ctx.fillText(line, 72, startY + i * lineHeight);
  });
  return startY + lines.length * lineHeight;
}

/** 中部要点区：每条最多两行，溢出时整体缩小字号 */
function drawBullets(
  ctx: CanvasRenderingContext2D,
  bullets: string[],
  color: string,
  topY: number,
): void {
  const list = bullets.slice(0, 4);
  if (list.length === 0) return;

  const maxWidth = SLIDE_W - 72 * 2 - 44;
  const areaBottom = SLIDE_H - 96; // 品牌条上方留白
  let fontSize = 30;
  let wrapped: string[][] = [];
  let lineHeight = 0;
  let itemGap = 0;

  for (; fontSize >= 22; fontSize -= 2) {
    ctx.font = `400 ${fontSize}px "Noto Sans SC", "PingFang SC", sans-serif`;
    wrapped = list.map((b) => {
      const lines = wrapText(ctx, b, maxWidth);
      if (lines.length > 2) return [lines[0], lines[1].slice(0, -1) + "…"];
      return lines;
    });
    lineHeight = fontSize * 1.55;
    itemGap = fontSize * 0.9;
    const totalH =
      wrapped.reduce((a, lines) => a + lines.length * lineHeight, 0) +
      itemGap * (list.length - 1);
    if (topY + 24 + totalH <= areaBottom) break;
  }

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  let y = topY + 24;
  wrapped.forEach((lines) => {
    // 左侧小色块
    ctx.fillStyle = color;
    roundRect(ctx, 72, y + fontSize * 0.28, 14, 14, 4);
    ctx.fill();
    ctx.fillStyle = "#2E2A26";
    lines.forEach((line, i) => {
      ctx.fillText(line, 72 + 44, y + i * lineHeight);
    });
    y += lines.length * lineHeight + itemGap;
  });
}

/** 底部品牌条：24px 高 */
function drawBrandBar(
  ctx: CanvasRenderingContext2D,
  lessonTitle: string,
  color: string,
  index: number,
  total: number,
): void {
  const barH = 24;
  const y = SLIDE_H - barH;
  ctx.fillStyle = "#F3EDE3";
  ctx.fillRect(0, y, SLIDE_W, barH);
  // 顶部 2px 阶段色进度段
  ctx.fillStyle = "#E7DFD3";
  ctx.fillRect(0, y, SLIDE_W, 2);
  ctx.fillStyle = color;
  ctx.fillRect(0, y, (SLIDE_W * (index + 1)) / total, 2);

  ctx.textBaseline = "middle";
  ctx.font = '500 13px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = "#6B6259";
  ctx.textAlign = "left";
  ctx.fillText("微课坊 MicroClass Studio", 72, y + barH / 2 + 1);
  ctx.textAlign = "right";
  ctx.fillStyle = "#A79C8F";
  const short = lessonTitle.length > 24 ? lessonTitle.slice(0, 23) + "…" : lessonTitle;
  ctx.fillText(short, SLIDE_W - 72, y + barH / 2 + 1);
}

/** 绘制一张干净教学画面 */
export async function renderSlide(
  section: ScriptSection,
  index: number,
  total: number,
  lessonTitle: string,
): Promise<SlideImage> {
  await ensureFonts();
  const [canvas, ctx] = createCanvas();
  const color = sectionColor(index);

  drawPaperBackground(ctx);
  drawBadge(ctx, section.label, color);
  const titleBottom = drawTitle(ctx, section.title);
  drawBullets(ctx, section.bullets, color, Math.max(titleBottom, 210));
  drawBrandBar(ctx, lessonTitle, color, index, total);

  const dataURL = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("画面导出失败");
  const bitmap = await createImageBitmap(blob);
  return { dataURL, bitmap, sectionIndex: index, label: section.label };
}

/**
 * 在干净画面底部叠加半透明深色字幕条，导出 PNG Blob（字幕帧）。
 * 字幕条高约 88px，白色 Noto Sans SC 30px 居中，最长两行。
 */
export async function renderCaptionFrame(
  slide: SlideImage,
  captionText: string,
): Promise<Blob> {
  await ensureFonts();
  const [canvas, ctx] = createCanvas();
  ctx.drawImage(slide.bitmap, 0, 0, SLIDE_W, SLIDE_H);

  const barH = 88;
  const barY = SLIDE_H - barH;
  ctx.fillStyle = "rgba(30, 26, 22, 0.82)";
  ctx.fillRect(0, barY, SLIDE_W, barH);

  const maxWidth = SLIDE_W - 120 * 2;
  let fontSize = 30;
  let lines: string[] = [];
  for (; fontSize >= 22; fontSize -= 2) {
    ctx.font = `400 ${fontSize}px "Noto Sans SC", "PingFang SC", sans-serif`;
    lines = wrapText(ctx, captionText, maxWidth);
    if (lines.length <= 2) break;
  }
  if (lines.length > 2) lines = [lines[0], lines[1].slice(0, -1) + "…"];

  const lineHeight = fontSize * 1.3;
  const blockH = lines.length * lineHeight;
  const startY = barY + (barH - blockH) / 2;
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, SLIDE_W / 2, startY + i * lineHeight);
  });

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("字幕帧导出失败");
  return blob;
}

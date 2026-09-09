/**
 * 浏览器端视频生成管线编排
 * ①生成讲解稿 0→15%  ②合成配音 15→45%  ③绘制画面 45→60%  ④合成视频 60→100%
 */
import {
  buildCaptionTimeline,
  type CaptionSegment,
  type LessonScript,
} from "./lesson";
import { renderCaptionFrame, renderSlide, type SlideImage } from "./slides";
import { assembleVideo } from "./video";

export type StageStatus = "pending" | "active" | "done" | "error";

export interface PipelineCallbacks {
  onStage?: (stageIndex: number, status: StageStatus) => void;
  onLog?: (stageIndex: number, line: string) => void;
  onProgress?: (percent: number) => void;
}

export interface PipelineResult {
  videoUrl: string;
  videoBlob: Blob;
  script: LessonScript;
  /** 四张干净画面 dataURL */
  slides: string[];
  slideImages: SlideImage[];
  segments: CaptionSegment[];
  /** 全部配音总时长（秒） */
  audioDuration: number;
  sectionDurations: number[];
}

export interface PipelineOptions {
  content: string;
  audience: string;
  voiceId?: string;
}

/* ---------------- API ---------------- */

async function fetchScript(content: string, audience: string): Promise<LessonScript> {
  const resp = await fetch("/api/script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, audience }),
  });

  // 异步任务模式（202）：后台生成，轮询取结果——绕开预览网关的长请求超时
  if (resp.status === 202) {
    const { jobId } = (await resp.json()) as { jobId: string };
    const deadline = Date.now() + 5 * 60 * 1000;
    for (;;) {
      await new Promise((r) => setTimeout(r, 2500));
      const r = await fetch(`/api/script/job/${jobId}`);
      if (!r.ok && r.status !== 404) continue; // 网关抖动时继续轮询
      const d = (await r.json()) as {
        status?: string;
        script?: LessonScript;
        error?: string;
      };
      if (d.status === "done" && d.script) return validateScript(d.script);
      if (d.status === "error") throw new Error(d.error || "讲解稿生成失败，请重新生成");
      if (Date.now() > deadline) throw new Error("讲解稿生成超时，请重新生成");
    }
  }

  if (!resp.ok) {
    let message = `请求失败（HTTP ${resp.status}）`;
    try {
      const data = await resp.json();
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      // 保留默认错误信息
    }
    throw new Error(message);
  }

  // 兼容旧的同步返回形态
  const data = (await resp.json()) as { script?: LessonScript } & LessonScript;
  const script = (data as { script?: LessonScript }).script ?? data;
  return validateScript(script);
}

function validateScript(script: LessonScript): LessonScript {
  if (!script || !Array.isArray(script.sections) || script.sections.length === 0) {
    throw new Error("讲解稿格式不正确");
  }
  return script;
}

async function fetchTTS(text: string, voiceId?: string): Promise<Blob> {
  const resp = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId }),
  });
  if (!resp.ok) {
    let message = `语音合成失败（HTTP ${resp.status}）`;
    try {
      const data = await resp.json();
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      // 保留默认错误信息
    }
    throw new Error(message);
  }
  return await resp.blob();
}

/* ---------------- 音频时长 ---------------- */

let audioCtx: AudioContext | null = null;

export async function decodeAudioDuration(blob: Blob): Promise<number> {
  audioCtx ??= new AudioContext();
  const buf = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(buf);
  return decoded.duration;
}

/* ---------------- 并发控制 ---------------- */

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ---------------- 主管线 ---------------- */

export async function runPipeline(
  options: PipelineOptions,
  cb: PipelineCallbacks = {},
): Promise<PipelineResult> {
  const { content, audience, voiceId } = options;
  let currentStage = -1;
  const stage = (i: number, s: StageStatus) => {
    if (s === "active") currentStage = i;
    cb.onStage?.(i, s);
  };
  const log = (i: number, line: string) => cb.onLog?.(i, line);
  const progress = (p: number) => cb.onProgress?.(Math.min(100, Math.max(0, p)));

  try {
    /* ① 生成讲解稿 0→15% */
    stage(0, "active");
    progress(2);
    log(0, "正在分析知识内容…");
    const script = await fetchScript(content, audience);
    const totalChars = script.sections.reduce(
      (a, s) => a + s.narration.replace(/\s/g, "").length,
      0,
    );
    log(0, `匹配「${audience}」语言风格与案例…`);
    log(0, `讲解稿完成，共 ${totalChars} 字`);
    progress(15);
    stage(0, "done");

    /* ② 合成配音 15→45%（并发 2，单段失败重试 1 次） */
    stage(1, "active");
    log(1, "开始合成四段中文配音…");
    const narrations = script.sections.map((s) => s.narration);
    let ttsDone = 0;
    const audioBlobs = await mapWithConcurrency(narrations, 2, async (text, i) => {
      try {
        const blob = await fetchTTS(text, voiceId);
        ttsDone++;
        log(1, `合成第 ${i + 1} 段语音 · 完成`);
        progress(15 + (ttsDone / narrations.length) * 30);
        return blob;
      } catch (firstErr) {
        log(1, `第 ${i + 1} 段失败，正在重试…`);
        try {
          const blob = await fetchTTS(text, voiceId);
          ttsDone++;
          log(1, `合成第 ${i + 1} 段语音 · 重试成功`);
          progress(15 + (ttsDone / narrations.length) * 30);
          return blob;
        } catch {
          throw firstErr;
        }
      }
    });
    log(1, "对齐字幕时间轴…");

    // 解码每段精确时长
    const sectionDurations: number[] = [];
    for (const blob of audioBlobs) {
      sectionDurations.push(await decodeAudioDuration(blob));
    }
    const audioDuration = sectionDurations.reduce((a, b) => a + b, 0);
    const segments = buildCaptionTimeline(script, sectionDurations);
    progress(45);
    stage(1, "done");

    /* ③ 绘制画面 45→60% */
    stage(2, "active");
    const slideImages: SlideImage[] = [];
    const totalDrawJobs = script.sections.length + segments.length;
    let drawDone = 0;
    const bumpDraw = () => {
      drawDone++;
      progress(45 + (drawDone / totalDrawJobs) * 15);
    };
    for (let i = 0; i < script.sections.length; i++) {
      const slide = await renderSlide(
        script.sections[i],
        i,
        script.sections.length,
        script.title,
      );
      slideImages.push(slide);
      log(2, `绘制画面 ${i + 1}/${script.sections.length} · ${script.sections[i].label}`);
      bumpDraw();
    }
    // 每个句子一张字幕帧
    const captionFrames: { data: Blob; duration: number }[] = [];
    for (const seg of segments) {
      const blob = await renderCaptionFrame(slideImages[seg.sectionIndex], seg.sentence);
      captionFrames.push({ data: blob, duration: seg.duration });
      bumpDraw();
    }
    progress(60);
    stage(2, "done");

    /* ④ 合成视频 60→100% */
    stage(3, "active");
    log(3, "加载视频合成引擎…");
    let lastVideoLog = "";
    const videoLog = (line: string) => {
      if (line !== lastVideoLog) {
        lastVideoLog = line;
        log(3, line);
      }
    };
    const { blobUrl, blob } = await assembleVideo({
      frames: captionFrames,
      audios: audioBlobs,
      onProgress: (ratio) => {
        progress(60 + ratio * 38);
        if (ratio > 0.05 && ratio < 0.6) videoLog("合成画面与配音…");
        else if (ratio >= 0.6 && ratio < 0.9) videoLog("嵌入字幕轨道…");
        else if (ratio >= 0.9) videoLog("导出 MP4 (1280×720)…");
      },
    });
    log(3, "MP4 导出完成");
    progress(100);
    stage(3, "done");

    return {
      videoUrl: blobUrl,
      videoBlob: blob,
      script,
      slides: slideImages.map((s) => s.dataURL),
      slideImages,
      segments,
      audioDuration,
      sectionDurations,
    };
  } catch (err) {
    if (currentStage >= 0) stage(currentStage, "error");
    throw err instanceof Error ? err : new Error(String(err));
  }
}

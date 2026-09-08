/**
 * 讲解稿类型与分句工具
 */

export interface ScriptSection {
  label: string;
  title: string;
  bullets: string[];
  narration: string;
}

export interface LessonScript {
  title: string;
  source: "moonshot" | "fallback" | string;
  sections: ScriptSection[];
}

/** 逐句字幕时间轴项 */
export interface CaptionSegment {
  sectionIndex: number;
  sentence: string;
  /** 相对整段音频的开始时间（秒） */
  start: number;
  /** 持续时长（秒） */
  duration: number;
}

/** 四部分固定阶段色（与设计稿一致） */
export const SECTION_COLORS = ["#C96F4A", "#B98A2F", "#6E7F8D", "#5F7A61"] as const;

export function sectionColor(index: number): string {
  return SECTION_COLORS[index % SECTION_COLORS.length];
}

/**
 * 按中英文句末标点切句，保留标点。
 * 例如 "你好。世界！好吗？" → ["你好。", "世界！", "好吗？"]
 */
export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^。！？!?；;]+[。！？!?；;]*/g) ?? [];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** 统计有效字数（去除空白与标点，用于时长分配） */
export function charWeight(sentence: string): number {
  const chars = sentence.replace(/[\s，。！？!?；;：:、,.…—\-「」『』""'']/g, "");
  return Math.max(chars.length, 1);
}

/**
 * 按句子字数比例分配该部分时长，单句最短 minDuration 秒，
 * 然后按比例缩放补偿使总时长严格等于 total。
 */
export function allocateDurations(
  sentences: string[],
  total: number,
  minDuration = 1.0,
): number[] {
  const n = sentences.length;
  if (n === 0) return [];
  if (total <= 0) return sentences.map(() => minDuration);

  const weights = sentences.map(charWeight);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // 初次按比例分配
  let durations = weights.map((w) => (w / weightSum) * total);

  // 提升到最短时长
  durations = durations.map((d) => Math.max(d, minDuration));

  // 缩放补偿，使总和 == total
  const current = durations.reduce((a, b) => a + b, 0);
  if (current > total) {
    // 只压缩高于最短时长的句子
    const adjustable = durations
      .map((d, i) => ({ d, i }))
      .filter((x) => x.d > minDuration + 1e-6);
    const adjustableSum = adjustable.reduce((a, x) => a + x.d, 0);
    const target = total - (current - adjustableSum);
    if (adjustable.length > 0 && target > 0) {
      const scale = target / adjustableSum;
      for (const { i } of adjustable) {
        durations[i] = Math.max(minDuration, durations[i] * scale);
      }
    }
  } else if (current < total) {
    // 多余的时间按权重补给各句
    const extra = total - current;
    durations = durations.map((d, i) => d + (weights[i] / weightSum) * extra);
  }

  return durations;
}

/** 生成整课字幕时间轴（每段音频依次衔接） */
export function buildCaptionTimeline(
  script: LessonScript,
  sectionDurations: number[],
): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let cursor = 0;
  script.sections.forEach((section, sectionIndex) => {
    const sentences = splitSentences(section.narration);
    const total = sectionDurations[sectionIndex] ?? 0;
    const durations = allocateDurations(sentences, total);
    sentences.forEach((sentence, i) => {
      segments.push({
        sectionIndex,
        sentence,
        start: cursor,
        duration: durations[i],
      });
      cursor += durations[i];
    });
    // 若某段没有可切分的句子，也要推进时间
    if (sentences.length === 0) cursor += total;
  });
  return segments;
}

/** 每部分的起止时间（供结果区时间戳显示） */
export function sectionTimeRanges(
  script: LessonScript,
  sectionDurations: number[],
): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let cursor = 0;
  script.sections.forEach((_, i) => {
    const d = sectionDurations[i] ?? 0;
    ranges.push({ start: cursor, end: cursor + d });
    cursor += d;
  });
  return ranges;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

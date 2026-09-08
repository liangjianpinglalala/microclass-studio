/** 讲解稿 JSON 契约 —— 前端管线与后端共用 */

export const SECTION_LABELS = ["问题引入", "知识解释", "案例", "小结"] as const;
export type SectionLabel = (typeof SECTION_LABELS)[number];

export interface ScriptSection {
  label: SectionLabel;
  /** 画面标题（≤14字） */
  title: string;
  /** 画面要点，2-3 条，每条 ≤16 字 */
  bullets: string[];
  /** 该部分口播稿（中文，口语化） */
  narration: string;
}

export interface LessonScript {
  /** 微课总标题（≤16字） */
  title: string;
  sections: ScriptSection[];
  /** 生成来源：moonshot=大模型生成，fallback=内置模板降级 */
  source: "moonshot" | "fallback";
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, "")
    .split(/(?<=[。！？!?；;])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 校验并尽量修复 LLM 输出，使其符合契约；失败返回 null */
export function normalizeScript(raw: unknown): LessonScript | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.title !== "string" || !Array.isArray(obj.sections)) return null;
  const sections: ScriptSection[] = [];
  for (let i = 0; i < SECTION_LABELS.length; i++) {
    const s = obj.sections[i] as Record<string, unknown> | undefined;
    if (!s) return null;
    const narration = typeof s.narration === "string" ? s.narration.trim() : "";
    if (!narration) return null;
    const bullets = Array.isArray(s.bullets)
      ? s.bullets
          .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
          .map((b) => b.trim().slice(0, 20))
          .slice(0, 4)
      : [];
    sections.push({
      label: SECTION_LABELS[i],
      title:
        typeof s.title === "string" && s.title.trim()
          ? s.title.trim().slice(0, 16)
          : SECTION_LABELS[i],
      bullets: bullets.length > 0 ? bullets : [SECTION_LABELS[i]],
      narration,
    });
  }
  return {
    title: obj.title.slice(0, 18),
    sections,
    source: "moonshot",
  };
}

/** 内置模板降级生成器（未配置 MOONSHOT_API_KEY 或 LLM 调用失败时使用） */
export function fallbackScript(content: string, audience: string): LessonScript {
  const clean = content.replace(/\s+/g, " ").trim();
  const sentences = splitSentences(clean);
  const topicRaw =
    sentences[0]?.replace(/[。！？!?；;]$/, "") ?? clean.slice(0, 20);
  // 取第一个分句作为主题，避免标题过长
  const topic = topicRaw.split(/[，,、：:]/)[0] || topicRaw;
  const short = topic.length > 12 ? topic.slice(0, 12) : topic;
  const pick = (i: number) => sentences[i % sentences.length] ?? topic;
  const mid = sentences.slice(1, 3).join("") || topic;

  return {
    title: `一分钟看懂：${short}`,
    source: "fallback",
    sections: [
      {
        label: "问题引入",
        title: "从一个问题开始",
        bullets: [`什么是${short}？`, "为什么它很重要"],
        narration: `同学你好！你有没有想过这样一个问题：${pick(0)}今天这节微课，我们就用大约一分钟的时间，为${audience}把这件事讲清楚。`,
      },
      {
        label: "知识解释",
        title: "核心概念",
        bullets: sentences.slice(0, 3).map((s) => s.replace(/[。！？!?；;]$/, "").slice(0, 16)),
        narration: `我们来看核心内容。${mid}这就是理解这个知识点最关键的部分。`,
      },
      {
        label: "案例",
        title: "举个例子",
        bullets: ["联系实际场景", "动手想一想"],
        narration: `光听概念可能有点抽象，我们结合一个具体的例子来看。${pick(2)}把刚才讲的内容套进这个场景，是不是就清楚多了？`,
      },
      {
        label: "小结",
        title: "要点回顾",
        bullets: ["理解核心概念", "结合案例思考", "课后加以练习"],
        narration: `最后我们来总结一下：今天我们围绕“${short}”，先提出问题，再讲解核心知识，并结合例子加深理解。课后请试着用自己的话复述一遍。我们下节微课再见！`,
      },
    ],
  };
}

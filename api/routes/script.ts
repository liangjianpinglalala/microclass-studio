import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { env } from "../lib/env";
import {
  fallbackScript,
  normalizeScript,
  type LessonScript,
} from "../lib/script-contract";

export const scriptRoute = new Hono();

const AUDIENCES = ["小学生", "初中生", "高中生", "大学生", "成人大众"];

function buildPrompt(content: string, audience: string) {
  return [
    {
      role: "system" as const,
      content:
        "你是一位优秀的微课教学设计专家，擅长把知识内容改写成 60 秒中文微课的讲解稿。" +
        "你只输出符合要求的 JSON，不输出任何其他文字。",
    },
    {
      role: "user" as const,
      content: `请把下面的知识内容改写成一份约 60 秒的中文微课讲解稿，学习对象是「${audience}」，语言要口语化、亲切、适合配音朗读，难度和举例要贴合该学习对象。

【知识内容】
${content.slice(0, 2000)}

【输出要求】严格输出 JSON（不要 markdown 代码块），结构如下：
{
  "title": "微课总标题，不超过16字",
  "sections": [
    {"label": "问题引入", "title": "画面标题，不超过14字", "bullets": ["画面要点，2到3条，每条不超过16字"], "narration": "该部分口播稿"},
    {"label": "知识解释", "title": "...", "bullets": ["..."], "narration": "..."},
    {"label": "案例", "title": "...", "bullets": ["..."], "narration": "..."},
    {"label": "小结", "title": "...", "bullets": ["..."], "narration": "..."}
  ]
}

【口播稿要求】
- 四部分 narration 字数合计 230 到 280 个汉字（中文播音约每秒4字，合计约60秒）；
- “问题引入”用一个贴近${audience}生活的问题开场；“知识解释”讲清核心概念；“案例”给一个具体易懂的例子；“小结”用两三句话回顾要点并收尾；
- narration 中不要出现小标题、序号或括号注释，直接是可以朗读的文字；
- bullets 是展示在画面上的短语，不是完整句子。`,
    },
  ];
}

async function callModel(
  model: string,
  content: string,
  audience: string,
  timeoutMs: number,
): Promise<LessonScript> {
  const resp = await fetch(`${env.moonshotBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.moonshotApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildPrompt(content, audience),
      // kimi-k2.x / k3 推理模型仅允许 temperature=1
      temperature: 1,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Moonshot API ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Moonshot 返回为空");
  const script = normalizeScript(JSON.parse(raw));
  if (!script) throw new Error("Moonshot 返回的 JSON 不符合讲解稿结构");
  return script;
}

/**
 * 模型链：主模型（默认 kimi-k2.7-code-highspeed，约 10 秒出稿）
 * → 备用 kimi-k3（约 40 秒）→ 内置模板。保证讲解稿环节永远有结果。
 */
async function generateScript(
  content: string,
  audience: string,
): Promise<LessonScript> {
  if (!env.moonshotApiKey) {
    console.warn("[script] 未配置 MOONSHOT_API_KEY，使用模板降级");
    return fallbackScript(content, audience);
  }
  const chain: { model: string; timeout: number }[] = [
    { model: env.moonshotModel, timeout: 45_000 },
  ];
  if (env.moonshotModel !== "kimi-k3") {
    chain.push({ model: "kimi-k3", timeout: 45_000 });
  }
  for (const step of chain) {
    try {
      return await callModel(step.model, content, audience, step.timeout);
    } catch (e) {
      console.error(`[script] 模型 ${step.model} 调用失败:`, e);
    }
  }
  console.error("[script] 所有模型均失败，使用模板降级");
  return fallbackScript(content, audience);
}

function validateInput(body: { content?: string; audience?: string }) {
  const content = (body.content ?? "").trim();
  const audience = (body.audience ?? "").trim() || "成人大众";
  if (content.length < 10) return { error: "知识内容太短，请至少输入 10 个字" as const };
  if (!AUDIENCES.includes(audience)) return { error: "学习对象不合法" as const };
  return { content, audience };
}

// ── 主接口：同步返回（主模型约 10 秒，远低于网关超时） ──
scriptRoute.post("/api/script", async (c) => {
  let body: { content?: string; audience?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求体必须是 JSON" }, 400);
  }
  const input = validateInput(body);
  if ("error" in input) return c.json({ error: input.error }, 400);
  const script = await generateScript(input.content, input.audience);
  return c.json(script);
});

// ── 异步任务模式（保留兼容：POST /api/script/job 创建，GET 轮询） ──
type Job = {
  status: "pending" | "done" | "error";
  script?: LessonScript;
  error?: string;
  createdAt: number;
};
const jobs = new Map<string, Job>();
const JOB_TTL = 10 * 60 * 1000;

function sweepJobs() {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.createdAt > JOB_TTL) jobs.delete(id);
  }
}

scriptRoute.post("/api/script/job", async (c) => {
  let body: { content?: string; audience?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求体必须是 JSON" }, 400);
  }
  const input = validateInput(body);
  if ("error" in input) return c.json({ error: input.error }, 400);
  sweepJobs();
  const jobId = randomUUID();
  jobs.set(jobId, { status: "pending", createdAt: Date.now() });
  void (async () => {
    try {
      const script = await generateScript(input.content, input.audience);
      jobs.set(jobId, { status: "done", script, createdAt: Date.now() });
    } catch (e) {
      console.error("[script] 任务执行异常:", e);
      jobs.set(jobId, {
        status: "error",
        error: "讲解稿生成失败，请重新生成",
        createdAt: Date.now(),
      });
    }
  })();
  return c.json({ jobId }, 202);
});

scriptRoute.get("/api/script/job/:id", (c) => {
  const job = jobs.get(c.req.param("id"));
  if (!job) {
    return c.json({ error: "任务不存在或已过期，请重新生成" }, 404);
  }
  if (job.status === "done") {
    return c.json({ status: "done", script: job.script });
  }
  if (job.status === "error") {
    return c.json({ status: "error", error: job.error ?? "讲解稿生成失败" });
  }
  return c.json({ status: "pending" });
});

import { Hono } from "hono";
import { env } from "../lib/env";

export const ttsRoute = new Hono();

/** 平台支持的中文音色 */
export const VOICES: Record<string, string> = {
  "05Cdh2gw2NMzDvykn1nm": "沉稳男声",
  Q63G7WZ5riIGbK8KmqO9: "活力男声",
  NLl76XZRVj1RVeXptX3h: "温暖女声",
  At6gj9vUVdJhTriBsuxE: "明快女声",
};
const DEFAULT_VOICE = "NLl76XZRVj1RVeXptX3h";

ttsRoute.get("/api/voices", (c) =>
  c.json({ voices: VOICES, default: DEFAULT_VOICE }),
);

ttsRoute.post("/api/tts", async (c) => {
  if (!env.agentGwApiKey) {
    return c.json({ error: "服务端未配置 AGENT_GW_API_KEY" }, 500);
  }
  let body: { text?: string; voice_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求体必须是 JSON" }, 400);
  }
  const text = (body.text ?? "").trim();
  if (!text) return c.json({ error: "text 不能为空" }, 400);
  if (text.length > 600) return c.json({ error: "单段文字过长（>600字）" }, 400);
  const voiceId =
    body.voice_id && VOICES[body.voice_id] ? body.voice_id : DEFAULT_VOICE;

  // 1) 调用 agent-gw 语音合成
  const gwResp = await fetch(`${env.agentGwBaseUrl}/v1/tools`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.agentGwApiKey}`,
    },
    body: JSON.stringify({
      method: "generate_speech",
      params: { text, voice_id: voiceId },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!gwResp.ok) {
    const t = await gwResp.text().catch(() => "");
    return c.json({ error: `语音合成服务错误 ${gwResp.status}: ${t.slice(0, 200)}` }, 502);
  }
  const gwData = (await gwResp.json()) as {
    media?: { url?: string; mime_type?: string };
    error?: unknown;
  };
  const mediaUrl = gwData.media?.url;
  if (!mediaUrl) {
    return c.json({ error: `语音合成失败: ${JSON.stringify(gwData).slice(0, 200)}` }, 502);
  }

  // 2) 下载音频并回传字节（前端无需处理跨域/鉴权）
  const audioResp = await fetch(mediaUrl, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!audioResp.ok || !audioResp.body) {
    return c.json({ error: `音频下载失败 ${audioResp.status}` }, 502);
  }
  const buf = await audioResp.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "no-store",
    },
  });
});

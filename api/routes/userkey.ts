import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { encryptSecret } from "../lib/crypto";
import { env } from "../lib/env";
import { requireAuth } from "./auth";

/**
 * 用户自己的 Moonshot API 密钥管理
 * - 保存前先真实调用 Moonshot /v1/models 验证密钥有效性，拒绝假密钥
 * - 数据库只存 AES-256-GCM 密文；任何接口都不返回密钥明文
 */
type AuthUserCtx = { id: number; username: string; displayName: string; role: string };

export const userkeyRoute = new Hono<{ Variables: { authUser: AuthUserCtx } }>();

userkeyRoute.use("/api/user/key", requireAuth);

const KEY_RE = /^sk-[A-Za-z0-9]{16,}$/;

async function verifyWithMoonshot(apiKey: string): Promise<"ok" | "invalid" | "unreachable"> {
  try {
    const resp = await fetch(`${env.moonshotBaseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.ok) return "ok";
    if (resp.status === 401 || resp.status === 403) return "invalid";
    return "unreachable";
  } catch {
    return "unreachable";
  }
}

/** 保存（或更新）我的 Moonshot 密钥 */
userkeyRoute.put("/api/user/key", async (c) => {
  let body: { apiKey?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求体必须是 JSON" }, 400);
  }
  const apiKey = (body.apiKey ?? "").trim();
  if (!KEY_RE.test(apiKey)) {
    return c.json({ error: "密钥格式不正确，Moonshot 密钥以 sk- 开头" }, 400);
  }

  const verdict = await verifyWithMoonshot(apiKey);
  if (verdict === "invalid") {
    return c.json({ error: "该密钥无效，请检查是否复制完整（Moonshot 返回 401）" }, 400);
  }
  if (verdict === "unreachable") {
    return c.json({ error: "暂时无法连接 Moonshot 验证密钥，请稍后重试" }, 502);
  }

  const authUser = c.get("authUser");
  await getDb()
    .update(users)
    .set({ moonshotKeyEnc: encryptSecret(apiKey) })
    .where(eq(users.id, authUser.id));
  return c.json({ ok: true, hasMoonshotKey: true });
});

/** 删除我的 Moonshot 密钥 */
userkeyRoute.delete("/api/user/key", async (c) => {
  const authUser = c.get("authUser");
  await getDb()
    .update(users)
    .set({ moonshotKeyEnc: null })
    .where(eq(users.id, authUser.id));
  return c.json({ ok: true, hasMoonshotKey: false });
});

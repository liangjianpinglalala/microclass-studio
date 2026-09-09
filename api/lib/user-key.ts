import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { decryptSecret } from "./crypto";
import { env } from "./env";

/**
 * 讲解稿生成的密钥决策：
 * - 用户配置了自己的 Moonshot 密钥 → 用用户自己的（扣用户额度）
 * - 管理员未配置 → 允许用站点密钥（站长自用/演示）
 * - 普通用户未配置 → none（拒绝生成）
 */
export type MoonshotKeyResolution =
  | { kind: "user"; apiKey: string }
  | { kind: "site"; apiKey: string }
  | { kind: "none" };

export async function resolveMoonshotKey(
  authUser: { id: number; role: string },
): Promise<MoonshotKeyResolution> {
  const db = getDb();
  const rows = await db
    .select({ moonshotKeyEnc: users.moonshotKeyEnc })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);
  const enc = rows[0]?.moonshotKeyEnc;
  if (enc) {
    try {
      return { kind: "user", apiKey: decryptSecret(enc) };
    } catch (e) {
      console.error("[user-key] 解密失败，按未配置处理:", e);
    }
  }
  if (authUser.role === "admin" && env.moonshotApiKey) {
    return { kind: "site", apiKey: env.moonshotApiKey };
  }
  return { kind: "none" };
}

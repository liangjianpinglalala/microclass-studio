import { Hono } from "hono";
import { desc, gt } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { users, sessions } from "@db/schema";
import { requireAuth, requireAdmin } from "./auth";

export const adminRoute = new Hono();

adminRoute.use("/api/admin/*", requireAuth, requireAdmin);

/** 会员列表：仅管理员可见；绝不返回密码散列等敏感字段 */
adminRoute.get("/api/admin/users", async (c) => {
  const db = getDb();
  const list = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      moonshotKeyEnc: users.moonshotKeyEnc,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const safeList = list.map(({ moonshotKeyEnc, ...u }) => ({
    ...u,
    hasMoonshotKey: Boolean(moonshotKeyEnc),
  }));

  // 近 7 天新增会员数
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const newThisWeek = safeList.filter((u) => u.createdAt >= weekAgo).length;

  return c.json({
    total: safeList.length,
    newThisWeek,
    users: safeList,
  });
});

/** 有效会话数（当前处于登录状态的凭证数量） */
adminRoute.get("/api/admin/stats", async (c) => {
  const db = getDb();
  const rows = await db
    .select({ token: sessions.token })
    .from(sessions)
    .where(gt(sessions.expiresAt, new Date()));
  return c.json({ activeSessions: rows.length });
});

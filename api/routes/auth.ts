import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { eq, and, gt } from "drizzle-orm";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "../queries/connection";
import { users, sessions } from "@db/schema";
import { env } from "../lib/env";

export const authRoute = new Hono();

const COOKIE_NAME = "mc_session";
const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 3600 * 1000;

/* ---------------- 密码散列（scrypt + 随机盐） ---------------- */

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function verifyPassword(password: string, salt: string, expected: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const want = Buffer.from(expected, "hex");
  return actual.length === want.length && timingSafeEqual(actual, want);
}

/* ---------------- 会话 ---------------- */

async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await getDb().insert(sessions).values({ token, userId, expiresAt });
  return { token, expiresAt };
}

type SessionUser = { id: number; username: string; displayName: string; role: string };

async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string, expiresAt: Date) {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.isProduction,
    path: "/",
    expires: expiresAt,
  });
}

/** 受保护接口中间件：未登录返回 401 */
export const requireAuth = createMiddleware(async (c, next) => {
  try {
    const user = await getSessionUser(getCookie(c, COOKIE_NAME));
    if (!user) {
      return c.json({ error: "请先登录后再使用" }, 401);
    }
    c.set("authUser", user);
    await next();
  } catch (e) {
    console.error("[auth] 会话校验失败（数据库异常）:", e);
    return c.json({ error: "会员服务暂时不可用，请稍后重试" }, 503);
  }
});

/** 管理员接口中间件：需登录且 role=admin（在 requireAuth 之后使用） */
export const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get("authUser") as SessionUser | undefined;
  if (!user) {
    return c.json({ error: "请先登录后再使用" }, 401);
  }
  if (user.role !== "admin") {
    return c.json({ error: "仅管理员可以查看会员列表" }, 403);
  }
  await next();
});

/* ---------------- 校验 ---------------- */

const USERNAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,20}$/;

function validateCredentials(body: { username?: string; password?: string }) {
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!USERNAME_RE.test(username)) {
    return { error: "用户名需为 2-20 个字符（中文、字母、数字或下划线）" as const };
  }
  if (password.length < 6 || password.length > 64) {
    return { error: "密码需为 6-64 个字符" as const };
  }
  return { username, password };
}

/* ---------------- 路由 ---------------- */

authRoute.post("/api/auth/register", async (c) => {
  let body: { username?: string; password?: string; displayName?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求体必须是 JSON" }, 400);
  }
  const input = validateCredentials(body);
  if ("error" in input) return c.json({ error: input.error }, 400);
  const displayName = (body.displayName ?? "").trim().slice(0, 20) || input.username;

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);
  if (existing.length > 0) {
    return c.json({ error: "该用户名已被注册，请换一个或直接登录" }, 409);
  }

  const salt = randomBytes(16).toString("hex");
  const result = await db.insert(users).values({
    username: input.username,
    passwordHash: hashPassword(input.password, salt),
    salt,
    displayName,
  });
  const userId = Number(result[0].insertId);
  const { token, expiresAt } = await createSession(userId);
  setSessionCookie(c, token, expiresAt);
  return c.json({ user: { id: userId, username: input.username, displayName, role: "user" } });
});

authRoute.post("/api/auth/login", async (c) => {
  let body: { username?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求体必须是 JSON" }, 400);
  }
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return c.json({ error: "请输入用户名和密码" }, 400);
  }

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return c.json({ error: "用户名或密码不正确" }, 401);
  }
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(c, token, expiresAt);
  return c.json({
    user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
  });
});

authRoute.post("/api/auth/logout", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (token) {
    await getDb().delete(sessions).where(eq(sessions.token, token));
  }
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

authRoute.get("/api/auth/me", async (c) => {
  const user = await getSessionUser(getCookie(c, COOKIE_NAME));
  if (!user) return c.json({ error: "未登录" }, 401);
  return c.json({ user });
});

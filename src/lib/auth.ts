/**
 * 会员认证 API 客户端
 * 所有业务接口要求登录；401 时广播 "mc:auth-required" 事件，由 Home 统一跳回登录页
 */

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  /** user=普通会员，admin=管理员 */
  role?: string;
  /** 是否已配置自己的 Moonshot API 密钥 */
  hasMoonshotKey?: boolean;
}

/** 管理员看到的会员条目 */
export interface AdminUserItem {
  id: number;
  username: string;
  displayName: string;
  role: string;
  hasMoonshotKey: boolean;
  createdAt: string;
}

/** 保存我的 Moonshot 密钥（后端会先验证有效性） */
export async function saveMoonshotKey(apiKey: string): Promise<void> {
  const resp = await apiFetch("/api/user/key", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!resp.ok) throw await parseError(resp, `保存失败（HTTP ${resp.status}）`);
}

/** 删除我的 Moonshot 密钥 */
export async function deleteMoonshotKey(): Promise<void> {
  const resp = await apiFetch("/api/user/key", { method: "DELETE" });
  if (!resp.ok) throw await parseError(resp, `删除失败（HTTP ${resp.status}）`);
}

export interface AdminUsersResponse {
  total: number;
  newThisWeek: number;
  users: AdminUserItem[];
}

/** 管理员：获取会员列表 */
export async function fetchAdminUsers(): Promise<AdminUsersResponse> {
  const resp = await apiFetch("/api/admin/users");
  if (!resp.ok) throw await parseError(resp, `请求失败（HTTP ${resp.status}）`);
  return (await resp.json()) as AdminUsersResponse;
}

export const AUTH_REQUIRED_EVENT = "mc:auth-required";

function notifyAuthRequired() {
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
}

async function parseError(resp: Response, fallback: string): Promise<Error> {
  try {
    const data = await resp.json();
    if (data && typeof data.error === "string") return new Error(data.error);
  } catch {
    // 忽略解析失败
  }
  return new Error(fallback);
}

/** 包装 fetch：遇到 401 自动广播跳登录事件 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const resp = await fetch(input, init);
  if (resp.status === 401 && !String(input).includes("/api/auth/")) {
    notifyAuthRequired();
  }
  return resp;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await parseError(resp, `请求失败（HTTP ${resp.status}）`);
  return (await resp.json()) as T;
}

/** 查询当前登录用户；未登录返回 null */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const resp = await fetch("/api/auth/me");
    if (!resp.ok) return null;
    const data = (await resp.json()) as { user?: AuthUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const data = await postJSON<{ user: AuthUser }>("/api/auth/login", { username, password });
  return data.user;
}

export async function register(
  username: string,
  password: string,
  displayName?: string,
): Promise<AuthUser> {
  const data = await postJSON<{ user: AuthUser }>("/api/auth/register", {
    username,
    password,
    displayName,
  });
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // 网络异常也照常清空本地状态
  }
}

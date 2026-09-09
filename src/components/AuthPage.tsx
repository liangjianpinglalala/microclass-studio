import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, LogIn, Sparkles, User, UserPlus } from "lucide-react";
import { login, register, type AuthUser } from "@/lib/auth";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export interface AuthPageProps {
  onSuccess: (user: AuthUser) => void;
}

/** 会员注册 / 登录页：未登录用户的第一屏 */
export default function AuthPage({ onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !submitting && username.trim().length >= 2 && password.length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const user =
        mode === "login"
          ? await login(username.trim(), password)
          : await register(username.trim(), password, displayName.trim() || undefined);
      onSuccess(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="w-full max-w-[420px]"
      >
        {/* 品牌区 */}
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="微课坊" className="mx-auto mb-4 h-12 w-12" />
          <h1 className="font-serif text-[26px] font-black text-ink">
            微课坊 <span className="text-primary">MicroClass Studio</span>
          </h1>
          <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">
            输入一段知识，生成一节微课。注册会员即可使用全部功能。
          </p>
        </div>

        {/* 卡片 */}
        <div className="rounded-xl border border-line bg-card p-6 shadow-card md:p-7">
          {/* 登录/注册切换 */}
          <div className="mb-6 inline-flex w-full rounded-lg bg-paper-deep p-1">
            {(
              [
                { id: "login", label: "登录", icon: LogIn },
                { id: "register", label: "注册会员", icon: UserPlus },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMode(id);
                    setError(null);
                  }}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[14px] transition-colors ${
                    active ? "text-primary-deep" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-tab"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-md bg-card shadow-card"
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10 font-medium">{label}</span>
                </button>
              );
            })}
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label htmlFor="auth-username" className="mb-1.5 block text-[13px] font-bold text-ink">
                用户名
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="auth-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="2-20 个字符（中文、字母、数字）"
                  autoComplete="username"
                  className="input-focus h-[46px] w-full rounded-lg border bg-card pl-10 pr-4 text-[15px] text-ink placeholder:text-ink-faint"
                />
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label htmlFor="auth-nickname" className="mb-1.5 block text-[13px] font-bold text-ink">
                  昵称 <span className="font-normal text-ink-faint">（选填）</span>
                </label>
                <input
                  id="auth-nickname"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="不填则使用用户名"
                  className="input-focus h-[46px] w-full rounded-lg border bg-card px-4 text-[15px] text-ink placeholder:text-ink-faint"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-[13px] font-bold text-ink">
                密码
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="input-focus h-[46px] w-full rounded-lg border bg-card pl-10 pr-4 text-[15px] text-ink placeholder:text-ink-faint"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-error/30 bg-error-soft px-4 py-2.5 text-[13px] leading-[1.6] text-error"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={!canSubmit}
              whileTap={canSubmit ? { scale: 0.98 } : undefined}
              className={`flex h-[48px] w-full items-center justify-center gap-2 rounded-lg text-[15px] font-bold text-white transition-all ${
                canSubmit
                  ? "bg-primary shadow-card hover:-translate-y-px hover:bg-primary-deep hover:shadow-card-hover"
                  : "cursor-not-allowed bg-ink-faint"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  {mode === "login" ? "正在登录…" : "正在注册…"}
                </>
              ) : (
                <>
                  <Sparkles className="h-4.5 w-4.5" />
                  {mode === "login" ? "登录，开始创作" : "注册并开始创作"}
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-4 text-center text-[12px] leading-[1.6] text-ink-faint">
            {mode === "login" ? "还没有账号？点上方「注册会员」免费注册" : "已有账号？点上方「登录」"}
          </p>
        </div>

        <p className="mt-6 text-center font-mono text-[11px] tracking-[0.12em] text-ink-faint">
          SCRIPT → VOICE → SCENES → RENDER
        </p>
      </motion.div>
    </div>
  );
}

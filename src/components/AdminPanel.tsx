import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Loader2, RefreshCw, Shield, Users, UserPlus, X } from "lucide-react";
import { fetchAdminUsers, type AdminUserItem } from "@/lib/auth";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

/** 会员管理面板：仅管理员可见，展示注册会员列表 */
export default function AdminPanel({ open, onClose }: AdminPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [newThisWeek, setNewThisWeek] = useState(0);
  const [members, setMembers] = useState<AdminUserItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setTotal(data.total);
      setNewThisWeek(data.newThisWeek);
      setMembers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(46,42,38,0.45)] px-4 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex max-h-[85dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_64px_rgba(46,42,38,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-deep">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-serif text-[17px] font-bold text-ink">会员管理</h2>
                  <p className="font-mono text-[10px] tracking-[0.14em] text-ink-faint">
                    MEMBER ADMIN
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  刷新
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center rounded-md p-1.5 text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 统计卡 */}
            <div className="grid grid-cols-2 gap-3 px-6 pt-5">
              <div className="rounded-xl border border-line bg-paper px-4 py-3">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                  <Users className="h-3.5 w-3.5" />
                  注册会员总数
                </div>
                <div className="mt-1 font-serif text-[26px] font-black text-ink">{total}</div>
              </div>
              <div className="rounded-xl border border-line bg-paper px-4 py-3">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                  <UserPlus className="h-3.5 w-3.5" />
                  近 7 天新增
                </div>
                <div className="mt-1 font-serif text-[26px] font-black text-accent">
                  {newThisWeek}
                </div>
              </div>
            </div>

            {/* 列表 */}
            <div className="mt-4 flex-1 overflow-y-auto px-6 pb-6">
              {loading && members.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-ink-faint">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载会员列表…
                </div>
              ) : error ? (
                <div className="rounded-xl border border-error/30 bg-error-soft px-4 py-6 text-center text-[14px] text-error">
                  {error}
                </div>
              ) : (
                <table className="w-full text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-line text-[12px] text-ink-faint">
                      <th className="py-2 pr-3 font-medium">用户名</th>
                      <th className="py-2 pr-3 font-medium">昵称</th>
                      <th className="py-2 pr-3 font-medium">角色</th>
                      <th className="py-2 font-medium">注册时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-ink">{m.username}</td>
                        <td className="py-2.5 pr-3 text-ink-soft">{m.displayName || "—"}</td>
                        <td className="py-2.5 pr-3">
                          {m.role === "admin" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[12px] font-medium text-primary-deep">
                              <Crown className="h-3 w-3" />
                              管理员
                            </span>
                          ) : (
                            <span className="text-[13px] text-ink-faint">会员</span>
                          )}
                        </td>
                        <td className="py-2.5 font-mono text-[12.5px] text-ink-soft">
                          {formatTime(m.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-4 text-center text-[12px] leading-[1.6] text-ink-faint">
                密码经加密哈希存储，任何人（包括管理员）都无法查看明文
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

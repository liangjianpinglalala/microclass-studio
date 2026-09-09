import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { deleteMoonshotKey, saveMoonshotKey } from "@/lib/auth";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const STEPS = [
  { title: "打开 Moonshot 开放平台", desc: "platform.moonshot.cn，用手机号免费注册并登录" },
  { title: "进入「用户中心 → API Key 管理」", desc: "在左侧菜单找到 API Key 管理页面" },
  { title: "点击「新建 API Key」", desc: "随便起个名字，创建后立即复制（只显示一次）" },
  { title: "粘贴到下方输入框并保存", desc: "我们会先验证密钥有效才会保存" },
];

export interface KeySettingsModalProps {
  open: boolean;
  hasKey: boolean;
  onClose: () => void;
  /** 保存/删除成功后回传最新状态 */
  onChanged: (hasKey: boolean) => void;
}

/** 密钥设置弹窗：用户配置自己的 Moonshot API 密钥（BYOK） */
export default function KeySettingsModal({ open, hasKey, onClose, onChanged }: KeySettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setApiKey("");
      setShowKey(false);
      setError(null);
      setJustSaved(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const canSubmit = !saving && !deleting && apiKey.trim().startsWith("sk-") && apiKey.trim().length >= 20;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await saveMoonshotKey(apiKey.trim());
      setJustSaved(true);
      onChanged(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMoonshotKey();
      onChanged(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

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
            className="flex max-h-[88dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_64px_rgba(46,42,38,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-deep">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-serif text-[17px] font-bold text-ink">密钥设置</h2>
                  <p className="font-mono text-[10px] tracking-[0.14em] text-ink-faint">
                    BRING YOUR OWN KEY
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center rounded-md p-1.5 text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* 当前状态 */}
              <div
                className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-[14px] ${
                  hasKey || justSaved
                    ? "border-accent/30 bg-accent-soft text-accent"
                    : "border-primary/30 bg-primary-soft text-primary-deep"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {hasKey || justSaved
                  ? "已配置你的 Moonshot 密钥，生成讲解稿将消耗你自己账户的额度"
                  : "还未配置密钥。配置自己的密钥后才能生成微课"}
              </div>

              {/* 获取指引 */}
              <div className="mb-5">
                <h3 className="mb-2.5 text-[13px] font-bold text-ink">
                  如何免费获取密钥？（约 2 分钟）
                </h3>
                <ol className="space-y-2">
                  {STEPS.map((s, i) => (
                    <li key={i} className="flex gap-3 rounded-lg bg-paper px-3.5 py-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft font-mono text-[11px] font-bold text-primary-deep">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-[13.5px] font-medium text-ink">{s.title}</div>
                        <div className="text-[12.5px] leading-[1.5] text-ink-faint">{s.desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <a
                  href="https://platform.moonshot.cn/console/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-primary-deep underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                >
                  直达 Moonshot API Key 管理页
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* 输入区 */}
              <div className="mb-2">
                <label htmlFor="moonshot-key" className="mb-1.5 block text-[13px] font-bold text-ink">
                  你的 Moonshot API 密钥
                </label>
                <div className="relative">
                  <input
                    id="moonshot-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasKey ? "已保存密钥，输入新密钥可替换" : "sk-..."}
                    autoComplete="off"
                    className="input-focus h-[46px] w-full rounded-lg border bg-card px-4 pr-11 font-mono text-[13.5px] text-ink placeholder:text-ink-faint"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                    aria-label={showKey ? "隐藏密钥" : "显示密钥"}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-2 rounded-lg border border-error/30 bg-error-soft px-3.5 py-2.5 text-[13px] text-error">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSubmit}
                  className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-[14.5px] text-white transition-opacity disabled:opacity-40"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "正在验证密钥…" : hasKey ? "验证并替换密钥" : "验证并保存密钥"}
                </button>
                {hasKey && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting || saving}
                    className="flex h-[42px] items-center gap-1.5 rounded-lg border border-error/30 px-4 text-[13.5px] text-error transition-colors hover:bg-error-soft disabled:opacity-40"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    删除
                  </button>
                )}
              </div>

              <p className="mt-4 text-[12px] leading-[1.7] text-ink-faint">
                密钥经 AES-256 加密后存储，仅用于替你调用 Moonshot 生成讲解稿；
                包括网站管理员在内的任何人都无法查看密钥原文。
                语音配音由平台语音服务提供，不消耗你的 Moonshot 额度。
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

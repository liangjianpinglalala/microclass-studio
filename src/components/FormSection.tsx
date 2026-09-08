import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Blocks,
  BookOpen,
  GraduationCap,
  Loader2,
  Mic,
  PenLine,
  Sparkles,
  Users,
} from "lucide-react";

const AUDIENCES = [
  { id: "小学生", icon: Blocks },
  { id: "初中生", icon: BookOpen },
  { id: "高中生", icon: PenLine },
  { id: "大学生", icon: GraduationCap },
  { id: "成人大众", icon: Users },
] as const;

const EXAMPLE =
  "光合作用是绿色植物利用光能，把二氧化碳和水转化成有机物，并释放氧气的过程。光合作用分为光反应和暗反应两个阶段，是地球上几乎所有生命能量的来源。";

const MAX_LEN = 2000;
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export interface FormSectionProps {
  content: string;
  onContentChange: (v: string) => void;
  audience: string;
  onAudienceChange: (v: string) => void;
  voices: Record<string, string>;
  voiceId: string;
  onVoiceChange: (v: string) => void;
  disabled: boolean;
  fallbackHint: boolean;
  onGenerate: () => void;
}

export default function FormSection(props: FormSectionProps) {
  const {
    content,
    onContentChange,
    audience,
    onAudienceChange,
    voices,
    voiceId,
    onVoiceChange,
    disabled,
    fallbackHint,
    onGenerate,
  } = props;

  const [typing, setTyping] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  const fillExample = () => {
    if (typing || disabled) return;
    onContentChange("");
    setTyping(true);
    let i = 0;
    timerRef.current = window.setInterval(() => {
      i++;
      onContentChange(EXAMPLE.slice(0, i));
      if (i >= EXAMPLE.length) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setTyping(false);
      }
    }, 18);
  };

  const len = content.length;
  const overLimit = len > MAX_LEN;
  const canGenerate = !disabled && !typing && len >= 10 && !overLimit;
  const voiceEntries = Object.entries(voices);

  return (
    <section className="pt-16">
      {/* S1.1 标题区 */}
      <div className="mx-auto mb-10 max-w-[720px] text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-4 flex flex-col items-center gap-2"
        >
          <span className="font-mono text-[11px] tracking-[0.16em] text-primary-deep">
            KNOWLEDGE → MICRO-LESSON · 知识到微课，一步之遥
          </span>
          <span className="h-[1.5px] w-6 bg-primary" />
        </motion.div>

        <h1 className="font-serif text-[30px] font-black leading-[1.25] tracking-[0.01em] text-ink md:text-[40px]">
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            输入一段知识，
          </motion.span>
          <motion.span
            className="inline-block text-primary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          >
            生成一节微课
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: EASE }}
          className="mx-auto mt-4 max-w-[560px] text-[15px] leading-[1.75] tracking-[0.01em] text-ink-soft"
        >
          粘贴任意知识内容，选择学习对象，微课坊将自动撰写一分钟中文讲解稿，绘制四张教学画面，配上中文配音与字幕，输出可下载的
          MP4 微课视频。
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.7 } },
          }}
          className="mt-5 flex items-center justify-center gap-2 font-mono text-[11px] text-ink-faint"
        >
          {["讲解稿", "配音", "画面", "视频"].map((step, i) => (
            <motion.span
              key={step}
              variants={{
                hidden: { opacity: 0, scale: 0.9 },
                show: { opacity: 1, scale: 1 },
              }}
              className="flex items-center gap-2"
            >
              <span className="rounded-full border border-line bg-card px-2.5 py-1">
                {step}
              </span>
              {i < 3 && <span>→</span>}
            </motion.span>
          ))}
        </motion.div>
      </div>

      {/* S1.2 输入表单卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
        className={`mx-auto max-w-[880px] rounded-xl border border-line bg-card p-5 shadow-card transition-opacity duration-300 md:p-8 ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <div className="mb-6">
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink-faint">
            STEP 01 · INPUT
          </p>
          <h2 className="mt-1 font-serif text-[22px] font-bold text-ink">
            生成你的微课
          </h2>
        </div>

        <div className="space-y-6">
          {/* 知识内容 */}
          <div>
            <div className="mb-2 flex items-end justify-between">
              <label
                htmlFor="content"
                className="text-[13px] font-bold tracking-[0.06em] text-ink"
              >
                知识内容
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-ink-faint">支持任意学科段落</span>
                <button
                  type="button"
                  onClick={fillExample}
                  disabled={disabled || typing}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] text-primary-deep transition-colors hover:bg-paper-deep disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  试试示例
                </button>
              </div>
            </div>
            <div className="relative">
              <textarea
                id="content"
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                disabled={disabled || typing}
                placeholder="例如：光合作用是绿色植物利用光能，把二氧化碳和水转化成有机物，并释放氧气的过程……"
                className="input-focus h-[160px] w-full resize-none rounded-lg border bg-card p-4 text-[15px] leading-[1.75] tracking-[0.01em] text-ink placeholder:text-ink-faint"
              />
              <span
                className={`pointer-events-none absolute bottom-3 right-3 font-mono text-[12px] ${
                  overLimit ? "text-error" : "text-ink-faint"
                }`}
              >
                {len} / {MAX_LEN} 字
              </span>
            </div>
          </div>

          {/* 学习对象 */}
          <div>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-[13px] font-bold tracking-[0.06em] text-ink">
                学习对象
              </span>
              <span className="text-[13px] text-ink-faint">
                讲解稿的语言风格与案例将据此调整
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label="学习对象"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            >
              {AUDIENCES.map(({ id, icon: Icon }) => {
                const selected = audience === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onAudienceChange(id)}
                    disabled={disabled}
                    className={`relative flex h-14 items-center justify-center gap-2 rounded-lg border text-[14px] transition-all duration-150 hover:-translate-y-px hover:bg-paper-deep ${
                      selected
                        ? "border-[1.5px] border-primary text-primary-deep"
                        : "border-line text-ink-soft"
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="audience-indicator"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-primary-soft"
                      />
                    )}
                    <Icon
                      className={`relative z-10 h-4 w-4 ${selected ? "text-primary-deep" : "text-ink-faint"}`}
                    />
                    <span className="relative z-10 font-medium">{id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 配音音色 */}
          {voiceEntries.length > 0 && (
            <div>
              <div className="mb-2 flex items-end justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.06em] text-ink">
                  <Mic className="h-3.5 w-3.5 text-ink-soft" />
                  配音音色
                </span>
                <span className="text-[13px] text-ink-faint">中文真人语音合成</span>
              </div>
              <div
                role="radiogroup"
                aria-label="配音音色"
                className="flex flex-wrap gap-2"
              >
                {voiceEntries.map(([id, name]) => {
                  const selected = voiceId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onVoiceChange(id)}
                      disabled={disabled}
                      className={`relative rounded-full border px-3.5 py-1.5 text-[13px] transition-all duration-150 hover:bg-paper-deep ${
                        selected
                          ? "border-[1.5px] border-primary text-primary-deep"
                          : "border-line text-ink-soft"
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="voice-indicator"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                          className="absolute inset-0 rounded-full bg-primary-soft"
                        />
                      )}
                      <span className="relative z-10">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 生成按钮 */}
          <motion.button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            whileTap={canGenerate ? { scale: 0.98 } : undefined}
            className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-lg text-[16px] font-bold text-white transition-all duration-150 ${
              canGenerate
                ? "bg-primary shadow-card hover:-translate-y-px hover:bg-primary-deep hover:shadow-card-hover"
                : "cursor-not-allowed bg-ink-faint"
            }`}
          >
            {disabled ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                正在生成…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                生成微课视频
                <span className="font-mono text-[11px] font-normal text-white/70">
                  ≈ 1 分钟
                </span>
              </>
            )}
          </motion.button>

          {/* fallback 提示条 */}
          {fallbackHint && (
            <div className="rounded-lg border border-line bg-paper-deep px-4 py-2.5 text-center text-[13px] text-ink-soft">
              讲解稿当前由内置模板生成，配置大模型后质量更佳
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}

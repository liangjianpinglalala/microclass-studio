import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clapperboard,
  Mic,
  Palette,
  PenLine,
  RotateCcw,
  X,
} from "lucide-react";
import type { StageStatus } from "@/lib/pipeline";

const STEPS = [
  { name: "生成讲解稿", eng: "SCRIPT", icon: PenLine, color: "#C96F4A" },
  { name: "合成配音", eng: "VOICE", icon: Mic, color: "#D9A441" },
  { name: "绘制画面", eng: "SCENES", icon: Palette, color: "#7A86A8" },
  { name: "合成视频", eng: "RENDER", icon: Clapperboard, color: "#5F7A61" },
] as const;

export interface PipelineSectionProps {
  stages: StageStatus[];
  logs: string[][];
  progress: number;
  finished: boolean;
  error: string | null;
  onRetry: () => void;
}

/** 单个步骤的状态圆（隔离无限动画） */
const StepCircle = memo(function StepCircle({
  status,
  color,
  icon: Icon,
}: {
  status: StageStatus;
  color: string;
  icon: typeof PenLine;
}) {
  if (status === "done") {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Check className="h-5 w-5 text-white" strokeWidth={3} />
        </motion.span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error">
        <X className="h-5 w-5 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 rounded-full animate-breathe-glow" />
        {/* 旋转进度弧 */}
        <svg
          className="absolute inset-0 h-12 w-12 animate-spin-slow"
          viewBox="0 0 48 48"
          fill="none"
        >
          <circle
            cx="24"
            cy="24"
            r="21"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="40 92"
          />
        </svg>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border-2"
          style={{ borderColor: color }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-line">
      <Icon className="h-5 w-5 text-ink-faint" />
    </div>
  );
});

function StepCard({
  index,
  status,
  logs,
}: {
  index: number;
  status: StageStatus;
  logs: string[];
}) {
  const step = STEPS[index];
  const recent = logs.slice(-2);
  return (
    <motion.div
      role="listitem"
      aria-current={status === "active" ? "step" : undefined}
      animate={{
        backgroundColor:
          status === "done" ? "#E4EDE4" : status === "error" ? "#F6E3E0" : "#FFFFFF",
        y: status === "active" ? -2 : 0,
      }}
      transition={{ duration: 0.4 }}
      className="relative z-10 min-h-[120px] rounded-lg border border-line p-4 md:min-h-[150px]"
    >
      <div className="flex items-center gap-3 md:flex-col md:items-start">
        <StepCircle status={status} color={step.color} icon={step.icon} />
        <div>
          <h3 className="text-[15px] font-bold text-ink md:text-[17px]">{step.name}</h3>
          <p className="font-mono text-[11px] tracking-[0.1em] text-ink-faint">
            {step.eng}
          </p>
        </div>
      </div>
      <div className="mt-3 min-h-[36px]">
        {status === "pending" && (
          <p className="font-mono text-[12px] text-ink-faint">等待中</p>
        )}
        {status === "done" && (
          <p className="font-mono text-[12px] text-accent">已完成</p>
        )}
        {status === "error" && (
          <p className="font-mono text-[12px] text-error">失败</p>
        )}
        {status === "active" && (
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {recent.map((line) => (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="font-mono text-[12px] leading-[1.6] text-ink-soft"
                >
                  {line}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function PipelineSection({
  stages,
  logs,
  progress,
  finished,
  error,
  onRetry,
}: PipelineSectionProps) {
  const pct = Math.round(progress);
  return (
    <section className="mx-auto mt-10 max-w-[880px] rounded-xl border border-line bg-card p-5 shadow-card md:p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink-faint">
            STEP 02 · PIPELINE
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-serif text-[22px] font-bold text-ink">
            {finished ? (
              <>
                <motion.span
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-accent"
                >
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                </motion.span>
                制作完成
              </>
            ) : (
              "正在制作你的微课"
            )}
          </h2>
        </div>
        <span className="font-mono text-[28px] font-medium text-primary-deep">
          {pct}%
        </span>
      </div>

      {/* 步骤流水线 */}
      <div role="list" className="relative grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* 桌面连接线 */}
        <div className="absolute left-0 right-0 top-6 hidden md:block" aria-hidden>
          <div className="mx-16 flex justify-between">
            {STEPS.slice(0, 3).map((step, i) => (
              <div key={i} className="relative mx-6 h-0.5 flex-1">
                <div className="absolute inset-0 border-t-2 border-dashed border-line" />
                <motion.div
                  className="absolute inset-0 origin-left"
                  style={{ backgroundColor: step.color }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: stages[i] === "done" ? 1 : 0 }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            ))}
          </div>
        </div>
        {STEPS.map((_, i) => (
          <StepCard key={i} index={i} status={stages[i]} logs={logs[i] ?? []} />
        ))}
      </div>

      {/* 错误卡片 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-lg border border-error/30 bg-error-soft p-4">
              <p className="text-[14px] font-bold text-error">生成失败</p>
              <p className="mt-1 break-words font-mono text-[12px] leading-[1.6] text-ink-soft">
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 flex items-center gap-1.5 rounded-lg border-[1.5px] border-error px-4 py-2 text-[14px] font-bold text-error transition-colors hover:bg-white"
              >
                <RotateCcw className="h-4 w-4" />
                重新生成
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部渐变进度条 */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-6 h-1 w-full overflow-hidden rounded-full bg-paper-deep"
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    </section>
  );
}

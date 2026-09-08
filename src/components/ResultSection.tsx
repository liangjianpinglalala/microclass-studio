import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  Play,
  RotateCcw,
} from "lucide-react";
import type { PipelineResult } from "@/lib/pipeline";
import { formatTime, sectionColor, sectionTimeRanges } from "@/lib/lesson";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export interface ResultSectionProps {
  result: PipelineResult;
  audience: string;
  onReset: () => void;
  showToast: (msg: string) => void;
}

function scriptPlainText(result: PipelineResult): string {
  const { script } = result;
  const parts = script.sections.map(
    (s, i) => `${String(i + 1).padStart(2, "0")} · ${s.label}「${s.title}」\n${s.narration}`,
  );
  return `《${script.title}》\n\n${parts.join("\n\n")}`;
}

export default function ResultSection({
  result,
  audience,
  onReset,
  showToast,
}: ResultSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);
  const { script, slides, audioDuration, sectionDurations } = result;
  const ranges = sectionTimeRanges(script, sectionDurations);
  const totalChars = script.sections.reduce(
    (a, s) => a + s.narration.replace(/\s/g, "").length,
    0,
  );
  const filename = `${script.title || "微课视频"}.mp4`;

  const copyScript = async () => {
    const text = scriptPlainText(result);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    showToast("讲解稿已复制到剪贴板");
    window.setTimeout(() => setCopied(false), 1500);
  };

  const seekTo = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    void v.play().catch(() => undefined);
    setStarted(true);
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const chips = [
    `学习对象：${audience}`,
    `时长 ${formatTime(audioDuration)}`,
    "1280×720",
    `讲解稿 ${totalChars} 字`,
  ];

  return (
    <section className="mt-16">
      {/* 顶部标题 */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-8 text-center"
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent">
          <Check className="h-5 w-5 text-white" strokeWidth={3} />
        </div>
        <h2 className="font-serif text-[26px] font-bold text-ink md:text-[30px]">
          你的微课已生成
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-medium text-primary-deep"
            >
              {chip}
            </span>
          ))}
        </div>
      </motion.div>

      {/* S3.1 视频播放器卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
        className="mx-auto max-w-[880px] rounded-xl border border-line bg-card p-4 shadow-card md:p-6"
      >
        <div className="relative overflow-hidden rounded-lg bg-[#1E1B18]" style={{ aspectRatio: "16/9" }}>
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={slides[0]}
            src={result.videoUrl}
            className="h-full w-full"
            onPlay={() => setStarted(true)}
          />
          {!started && (
            <motion.button
              type="button"
              aria-label="播放视频"
              onClick={() => {
                setStarted(true);
                void videoRef.current?.play().catch(() => undefined);
              }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.1 }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ scale: { duration: 2.4, repeat: Infinity } }}
              className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-card-hover"
            >
              <Play className="ml-1 h-7 w-7 text-white" fill="currentColor" />
            </motion.button>
          )}
          <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white">
            {formatTime(audioDuration)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href={result.videoUrl}
              download={filename}
              onClick={() => showToast("已开始下载")}
              className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-accent px-4 py-2 text-[14px] font-bold text-accent transition-colors hover:bg-accent-soft"
            >
              <Download className="h-4 w-4" />
              下载 MP4
            </a>
            <span className="hidden font-mono text-[11px] text-ink-faint sm:inline">
              {filename}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copyScript}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[14px] text-ink-soft transition-colors hover:bg-paper-deep"
            >
              {copied ? (
                <Check className="h-4 w-4 text-accent" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              复制讲解稿
            </button>
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[14px] text-ink-soft transition-colors hover:bg-paper-deep"
            >
              <RotateCcw className="h-4 w-4" />
              重新生成
            </button>
          </div>
        </div>
      </motion.div>

      {/* S3.2 四场景画廊 */}
      <div className="mx-auto mt-10 max-w-[880px]">
        <div className="mb-4 flex items-baseline gap-2">
          <h3 className="text-[17px] font-bold text-ink">教学画面 · 4 幕</h3>
          <span className="font-mono text-[11px] tracking-[0.1em] text-ink-faint">
            SCENES
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {script.sections.map((section, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: EASE }}
              whileHover={{ y: -3 }}
              className="group"
            >
              <div className="overflow-hidden rounded-md border border-line shadow-card transition-shadow duration-150 group-hover:shadow-card-hover">
                {slides[i] ? (
                  <img
                    src={slides[i]}
                    alt={`${section.label} 教学画面`}
                    className="aspect-video w-full object-cover transition-transform duration-[400ms] group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="skeleton-sheen aspect-video w-full" />
                )}
              </div>
              <figcaption className="mt-2 flex items-baseline justify-between">
                <span className="font-mono text-[11px] text-ink-faint">
                  SCENE {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {formatTime(ranges[i].start)}–{formatTime(ranges[i].end)}
                </span>
              </figcaption>
              <p className="text-[13px] font-bold text-ink">{section.label}</p>
            </motion.figure>
          ))}
        </div>
      </div>

      {/* S3.3 讲解稿全文卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto mt-10 max-w-[880px] rounded-xl border border-line bg-card p-5 shadow-card md:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-serif text-[22px] font-bold text-ink">讲解稿全文</h3>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-ink-faint">
              {totalChars} 字 · 约 {Math.round(audioDuration)} 秒
            </span>
            <button
              type="button"
              onClick={copyScript}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-ink-soft transition-colors hover:bg-paper-deep"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              复制
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-[640px] space-y-8">
          {script.sections.map((section, i) => (
            <motion.section
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.12, ease: EASE }}
            >
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center text-[17px] font-bold text-ink">
                  <span
                    className="mr-2.5 inline-block h-5 w-[3px] rounded-full"
                    style={{ backgroundColor: sectionColor(i) }}
                  />
                  {String(i + 1).padStart(2, "0")} · {section.label}
                  <span className="ml-2 text-[13px] font-normal text-ink-faint">
                    {section.title}
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => seekTo(ranges[i].start)}
                  title="跳转到视频对应时间"
                  className="font-mono text-[12px] text-ink-faint underline-offset-2 transition-colors hover:text-primary hover:underline"
                >
                  {formatTime(ranges[i].start)}–{formatTime(ranges[i].end)}
                </button>
              </div>
              <p className="text-[15px] leading-[1.75] tracking-[0.01em] text-ink">
                {section.narration}
              </p>
            </motion.section>
          ))}
        </div>
      </motion.div>

      {/* S3.4 再来一节 */}
      <div className="mt-12 text-center">
        <p className="mb-3 text-[14px] text-ink-soft">想再生成一节微课？</p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border-[1.5px] border-primary bg-card px-6 py-2.5 text-[15px] font-bold text-primary transition-all duration-150 hover:-translate-y-px hover:bg-primary-soft"
        >
          重新生成
        </button>
      </div>
    </section>
  );
}

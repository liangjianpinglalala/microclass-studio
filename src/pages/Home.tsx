import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FormSection from "@/components/FormSection";
import PipelineSection from "@/components/PipelineSection";
import ResultSection from "@/components/ResultSection";
import type { AppStatus } from "@/lib/app-types";
import { runPipeline, type PipelineResult, type StageStatus } from "@/lib/pipeline";

const INITIAL_STAGES: StageStatus[] = ["pending", "pending", "pending", "pending"];

export default function Home() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("初中生");
  const [voices, setVoices] = useState<Record<string, string>>({});
  const [voiceId, setVoiceId] = useState("");
  const [fallbackHint, setFallbackHint] = useState(false);
  const [stages, setStages] = useState<StageStatus[]>(INITIAL_STAGES);
  const [logs, setLogs] = useState<string[][]>([[], [], [], []]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pipelineRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);
  const generatingRef = useRef(false);

  /* 初始化：健康检查 + 音色列表 */
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { ok?: boolean; llm?: string }) => {
        if (data.llm === "fallback") setFallbackHint(true);
      })
      .catch(() => undefined);
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data: { voices?: Record<string, string>; default?: string }) => {
        if (data.voices) setVoices(data.voices);
        if (data.default) setVoiceId(data.default);
      })
      .catch(() => undefined);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const handleGenerate = useCallback(
    async (overrideContent?: string) => {
      if (generatingRef.current) return;
      const finalContent = (
        typeof overrideContent === "string" ? overrideContent : content
      ).trim();
      if (overrideContent !== undefined && typeof overrideContent === "string") {
        setContent(overrideContent);
      }
      generatingRef.current = true;
    setStatus("generating");
    setStages(["active", "pending", "pending", "pending"]);
    setLogs([[], [], [], []]);
    setProgress(0);
    setErrorMsg(null);
    setResult(null);

    window.setTimeout(() => {
      pipelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    try {
      const res = await runPipeline(
        { content: finalContent, audience, voiceId: voiceId || undefined },
        {
          onStage: (i, s) =>
            setStages((prev) => prev.map((v, idx) => (idx === i ? s : v))),
          onLog: (i, line) =>
            setLogs((prev) => {
              const next = prev.map((arr, idx) => {
                if (idx !== i) return arr;
                if (arr[arr.length - 1] === line) return arr;
                return [...arr, line].slice(-4);
              });
              return next;
            }),
          onProgress: setProgress,
        },
      );
      setResult(res);
      setStatus("done");
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败，请稍后重试";
      setErrorMsg(message);
      setStatus("error");
    } finally {
      generatingRef.current = false;
    }
  }, [content, audience, voiceId]);

  const handleReset = useCallback(() => {
    if (generatingRef.current) return;
    if (result) URL.revokeObjectURL(result.videoUrl);
    setResult(null);
    setErrorMsg(null);
    setStages(INITIAL_STAGES);
    setLogs([[], [], [], []]);
    setProgress(0);
    setStatus("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);

  const generating = status === "generating";
  const showPipeline = status !== "idle";

  return (
    <div className="min-h-[100dvh]">
      <Header status={status} />

      <main className="mx-auto max-w-[1080px] px-6 pb-8 md:px-4">
        <FormSection
          content={content}
          onContentChange={setContent}
          audience={audience}
          onAudienceChange={setAudience}
          voices={voices}
          voiceId={voiceId}
          onVoiceChange={setVoiceId}
          disabled={generating}
          fallbackHint={fallbackHint}
          onGenerate={handleGenerate}
        />

        <div ref={pipelineRef} className="scroll-mt-20">
          <AnimatePresence>
            {showPipeline && (
              <motion.div
                key="pipeline"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.5 }}
              >
                <PipelineSection
                  stages={stages}
                  logs={logs}
                  progress={progress}
                  finished={status === "done"}
                  error={status === "error" ? errorMsg : null}
                  onRetry={() => handleGenerate()}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={resultRef} className="scroll-mt-20">
          {status === "done" && result && (
            <ResultSection
              result={result}
              audience={audience}
              onReset={handleReset}
              showToast={showToast}
            />
          )}
        </div>
      </main>

      <Footer />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="fixed left-1/2 top-5 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 shadow-card-hover"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
            <span className="text-[14px] text-ink">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

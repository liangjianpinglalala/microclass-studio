import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FormSection from "@/components/FormSection";
import PipelineSection from "@/components/PipelineSection";
import ResultSection from "@/components/ResultSection";
import AuthPage from "@/components/AuthPage";
import AdminPanel from "@/components/AdminPanel";
import KeySettingsModal from "@/components/KeySettingsModal";
import type { AppStatus } from "@/lib/app-types";
import { runPipeline, type PipelineResult, type StageStatus } from "@/lib/pipeline";
import {
  AUTH_REQUIRED_EVENT,
  fetchMe,
  logout,
  type AuthUser,
} from "@/lib/auth";

const INITIAL_STAGES: StageStatus[] = ["pending", "pending", "pending", "pending"];

export default function Home() {
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(undefined);
  const [adminOpen, setAdminOpen] = useState(false);
  const [keySettingsOpen, setKeySettingsOpen] = useState(false);
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

  /* 初始化：登录态检查 + 401 跳登录监听 */
  useEffect(() => {
    let cancelled = false;
    fetchMe().then((user) => {
      if (!cancelled) setAuthUser(user);
    });
    const onAuthRequired = () => setAuthUser(null);
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    };
  }, []);

  /* 初始化：健康检查 + 音色列表（登录后加载） */
  useEffect(() => {
    if (!authUser) return;
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
  }, [authUser]);

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

  const handleLogout = useCallback(async () => {
    if (generatingRef.current) return;
    await logout();
    if (result) URL.revokeObjectURL(result.videoUrl);
    setResult(null);
    setErrorMsg(null);
    setStages(INITIAL_STAGES);
    setLogs([[], [], [], []]);
    setProgress(0);
    setStatus("idle");
    setAuthUser(null);
    setAdminOpen(false);
    setKeySettingsOpen(false);
  }, [result]);

  const generating = status === "generating";
  const showPipeline = status !== "idle";

  /* 登录态加载中 */
  if (authUser === undefined) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <img src="/logo.svg" alt="微课坊" className="h-10 w-10" />
          <span className="font-mono text-[12px] tracking-[0.14em] text-ink-faint">
            LOADING · 加载中
          </span>
        </motion.div>
      </div>
    );
  }

  /* 未登录：先注册/登录会员 */
  if (authUser === null) {
    return <AuthPage onSuccess={(user) => setAuthUser(user)} />;
  }

  return (
    <div className="min-h-[100dvh]">
      <Header
        status={status}
        user={authUser}
        onLogout={handleLogout}
        onOpenAdmin={() => setAdminOpen(true)}
        onOpenKeySettings={() => setKeySettingsOpen(true)}
      />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      <KeySettingsModal
        open={keySettingsOpen}
        hasKey={Boolean(authUser.hasMoonshotKey)}
        onClose={() => setKeySettingsOpen(false)}
        onChanged={(hasKey) =>
          setAuthUser((u) => (u ? { ...u, hasMoonshotKey: hasKey } : u))
        }
      />

      {/* 普通会员未配置密钥时的引导横幅 */}
      {authUser.role !== "admin" && !authUser.hasMoonshotKey && (
        <div className="border-b border-primary/20 bg-primary-soft">
          <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 py-2.5 text-[13.5px] text-primary-deep md:px-4">
            <span>生成微课将使用你自己的 Moonshot 密钥（免费申请），请先完成配置</span>
            <button
              type="button"
              onClick={() => setKeySettingsOpen(true)}
              className="rounded-md bg-primary px-3 py-1 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
            >
              去配置密钥
            </button>
          </div>
        </div>
      )}

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

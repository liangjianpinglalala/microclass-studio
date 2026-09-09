import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  FileUp,
  FileWarning,
  Loader2,
  PenLine,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/auth";

const MAX_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_LEN = 2000;
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface ExtractResult {
  text: string;
  fileType: "pptx" | "pdf";
  pages: number;
  chars: number;
  fileName: string;
}

export interface UploadPanelProps {
  disabled: boolean;
  onViewChange: (view: "upload" | "confirm") => void;
  onSwitchToPaste: () => void;
  onConfirm: (text: string) => void;
}

type PanelState =
  | { kind: "idle" }
  | { kind: "selected"; file: File }
  | { kind: "extracting"; file: File }
  | { kind: "error"; message: string }
  | { kind: "confirm"; result: ExtractResult };

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function UploadPanel(props: UploadPanelProps) {
  const { disabled, onViewChange, onSwitchToPaste, onConfirm } = props;
  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [editedText, setEditedText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const notifyView = (s: PanelState) => {
    onViewChange(s.kind === "confirm" ? "confirm" : "upload");
  };

  const transition = (s: PanelState) => {
    setState(s);
    notifyView(s);
  };

  const pickFile = useCallback(
    (file: File | undefined | null) => {
      if (!file || disabled) return;
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".pptx") && !lower.endsWith(".pdf")) {
        transition({ kind: "error", message: "仅支持 .pptx 或 .pdf 文件。" });
        return;
      }
      if (file.size > MAX_SIZE) {
        transition({ kind: "error", message: "文件超过 30MB 限制，请压缩或拆分后再上传。" });
        return;
      }
      transition({ kind: "selected", file });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled],
  );

  const extract = async (file: File) => {
    transition({ kind: "extracting", file });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/extract", { method: "POST", body: fd });
      const data = (await res.json()) as Partial<ExtractResult> & { error?: string };
      if (!res.ok || data.error) {
        transition({
          kind: "error",
          message: data.error || "文件解析失败，请重试。",
        });
        return;
      }
      const result: ExtractResult = {
        text: data.text ?? "",
        fileType: data.fileType === "pdf" ? "pdf" : "pptx",
        pages: data.pages ?? 0,
        chars: data.chars ?? (data.text?.length ?? 0),
        fileName: data.fileName ?? file.name,
      };
      setEditedText(result.text);
      transition({ kind: "confirm", result });
    } catch {
      transition({ kind: "error", message: "网络异常，请稍后重试。" });
    }
  };

  const reset = () => {
    setEditedText("");
    transition({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const confirmLen = editedText.trim().length;
  const confirmOver = confirmLen > MAX_LEN;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pptx,.pdf"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      <AnimatePresence mode="wait" initial={false}>
        {/* ── 上传区（idle / selected / extracting） ── */}
        {(state.kind === "idle" || state.kind === "selected" || state.kind === "extracting") && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="space-y-3"
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="上传课件文件"
              onClick={() => !disabled && inputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!disabled) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ${
                dragOver
                  ? "border-primary bg-primary-soft/50"
                  : "border-line bg-paper-deep/50 hover:border-primary/60 hover:bg-paper-deep"
              } ${disabled ? "pointer-events-none opacity-60" : ""}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
                <FileUp className="h-5 w-5 text-primary-deep" />
              </span>
              <p className="text-[15px] font-medium text-ink">
                拖拽文件到这里，或<span className="text-primary-deep underline underline-offset-2">点击选择</span>
              </p>
              <p className="font-mono text-[12px] text-ink-faint">支持 .pptx / .pdf · 最大 30MB</p>
            </div>

            {/* 已选文件信息行 */}
            {state.kind !== "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft">
                  <FileText className="h-4 w-4 text-primary-deep" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
                  {state.file.name}
                </span>
                <span className="shrink-0 font-mono text-[12px] text-ink-faint">
                  {formatSize(state.file.size)}
                </span>
                {state.kind === "selected" && (
                  <button
                    type="button"
                    aria-label="移除文件"
                    onClick={reset}
                    className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            )}

            {/* 提取按钮 */}
            {state.kind !== "idle" && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                onClick={() => state.kind === "selected" && extract(state.file)}
                disabled={state.kind !== "selected"}
                whileTap={state.kind === "selected" ? { scale: 0.98 } : undefined}
                className={`flex h-[46px] w-full items-center justify-center gap-2 rounded-lg text-[15px] font-bold text-white transition-all duration-150 ${
                  state.kind === "selected"
                    ? "bg-primary shadow-card hover:-translate-y-px hover:bg-primary-deep hover:shadow-card-hover"
                    : "cursor-wait bg-ink-faint"
                }`}
              >
                {state.kind === "extracting" ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    正在提取文字…
                  </>
                ) : (
                  <>
                    <FileText className="h-4.5 w-4.5" />
                    提取内容
                  </>
                )}
              </motion.button>
            )}
          </motion.div>
        )}

        {/* ── 错误卡片 ── */}
        {state.kind === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="rounded-xl border border-error/30 bg-error-soft px-5 py-6"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card">
                <FileWarning className="h-4.5 w-4.5 text-error" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-error">无法提取该文件</p>
                <p className="mt-1.5 text-[14px] leading-[1.7] text-ink-soft">{state.message}</p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-accent px-4 py-2 text-[14px] font-medium text-accent transition-colors hover:bg-accent-soft"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重新上传
                  </button>
                  <button
                    type="button"
                    onClick={onSwitchToPaste}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:bg-card hover:text-ink"
                  >
                    <PenLine className="h-4 w-4" />
                    改用粘贴文字
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 内容确认视图 ── */}
        {state.kind === "confirm" && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="space-y-4"
          >
            {/* 文件元信息 chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-medium text-accent">
                <CheckCircle2 className="h-3.5 w-3.5" />
                提取成功
              </span>
              <span className="max-w-[240px] truncate rounded-full bg-primary-soft px-3 py-1.5 text-[13px] font-medium text-primary-deep">
                {state.result.fileName}
              </span>
              <span className="rounded-full border border-line bg-card px-3 py-1.5 font-mono text-[12px] text-ink-soft">
                {state.result.fileType === "pptx" ? "PPT 课件" : "PDF 文档"}
              </span>
              <span className="rounded-full border border-line bg-card px-3 py-1.5 font-mono text-[12px] text-ink-soft">
                {state.result.pages} {state.result.fileType === "pptx" ? "页幻灯片" : "页"}
              </span>
              <span className="rounded-full border border-line bg-card px-3 py-1.5 font-mono text-[12px] text-ink-soft">
                提取 {state.result.chars} 字
              </span>
            </div>

            {/* 可编辑内容 */}
            <div>
              <div className="mb-2 flex items-end justify-between">
                <span className="text-[13px] font-bold tracking-[0.06em] text-ink">
                  提取的内容
                </span>
                <span className="text-[13px] text-ink-faint">可编辑修改，确认后据此生成讲解稿</span>
              </div>
              <div className="relative">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  disabled={disabled}
                  className="input-focus h-[220px] w-full resize-none rounded-lg border bg-card p-4 text-[14px] leading-[1.8] tracking-[0.01em] text-ink placeholder:text-ink-faint"
                />
                <span
                  className={`pointer-events-none absolute bottom-3 right-3 font-mono text-[12px] ${
                    confirmOver ? "text-error" : "text-ink-faint"
                  }`}
                >
                  {confirmLen} 字
                </span>
              </div>
              {confirmOver && (
                <div className="mt-2.5 rounded-lg border border-primary/30 bg-primary-soft/60 px-4 py-2.5 text-[13px] leading-[1.6] text-primary-deep">
                  内容较长，生成时将截取前 2000 字，建议删减至重点章节。
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <motion.button
                type="button"
                onClick={() => onConfirm(editedText.trim().slice(0, MAX_LEN))}
                disabled={disabled || confirmLen < 10}
                whileTap={confirmLen >= 10 ? { scale: 0.98 } : undefined}
                className={`flex h-[46px] flex-1 items-center justify-center gap-2 rounded-lg text-[15px] font-bold text-white transition-all duration-150 ${
                  confirmLen >= 10 && !disabled
                    ? "bg-primary shadow-card hover:-translate-y-px hover:bg-primary-deep hover:shadow-card-hover"
                    : "cursor-not-allowed bg-ink-faint"
                }`}
              >
                <Sparkles className="h-4.5 w-4.5" />
                确认内容，生成视频
              </motion.button>
              <button
                type="button"
                onClick={reset}
                disabled={disabled}
                className="flex h-[46px] items-center gap-1.5 rounded-lg border border-line bg-card px-5 text-[14px] font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <RotateCcw className="h-4 w-4" />
                重新上传
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AppStatus } from "@/lib/app-types";

const BADGE: Record<
  AppStatus,
  { dot: string; text: string; cls: string; pulse?: boolean }
> = {
  idle: { dot: "#A79C8F", text: "READY · 待生成", cls: "text-ink-soft bg-paper-deep" },
  generating: {
    dot: "#C96F4A",
    text: "GENERATING · 生成中",
    cls: "text-primary-deep bg-primary-soft",
    pulse: true,
  },
  done: { dot: "#5F7A61", text: "DONE · 已完成", cls: "text-accent bg-accent-soft" },
  error: { dot: "#B4544A", text: "ERROR · 需重试", cls: "text-error bg-error-soft" },
};

export default function Header({ status }: { status: AppStatus }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const badge = BADGE[status];

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="sticky top-0 z-50 h-16 border-b bg-[rgba(250,246,240,0.85)] backdrop-blur-[12px] transition-shadow duration-200"
      style={{
        borderColor: scrolled ? "rgba(231,223,211,1)" : "rgba(231,223,211,0.6)",
        boxShadow: scrolled ? "0 1px 8px rgba(46,42,38,0.05)" : "none",
      }}
    >
      <div className="mx-auto flex h-full max-w-[1080px] items-center justify-between px-6 md:px-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="微课坊" className="h-7 w-7" />
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[18px] font-bold text-ink">微课坊</span>
            <span className="font-mono text-[11px] tracking-[0.14em] text-ink-faint">
              MICROCLASS STUDIO
            </span>
          </div>
        </div>
        <div
          className={`flex h-7 items-center gap-2 rounded-full px-3 font-mono text-[12px] ${badge.cls}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${badge.pulse ? "animate-breathe-dot" : ""}`}
            style={{ backgroundColor: badge.dot }}
          />
          <AnimatePresence mode="wait">
            <motion.span
              key={status}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {badge.text}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}

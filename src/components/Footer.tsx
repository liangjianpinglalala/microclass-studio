import { motion } from "framer-motion";

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="mt-24 border-t border-line bg-paper-deep py-6"
    >
      <div className="mx-auto flex max-w-[1080px] flex-col items-center justify-between gap-2 px-6 sm:flex-row md:px-4">
        <p className="text-[12px] tracking-[0.04em] text-ink-faint">
          微课坊 MicroClass Studio · 教育技术课程项目
        </p>
        <p className="font-mono text-[11px] tracking-[0.1em] text-ink-faint">
          SCRIPT → VOICE → SCENES → RENDER
        </p>
      </div>
    </motion.footer>
  );
}

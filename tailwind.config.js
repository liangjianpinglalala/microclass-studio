/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 微课坊 · 低饱和暖色纸感体系
        paper: "#FAF6F0",
        "paper-deep": "#F3EDE3",
        ink: "#2E2A26",
        "ink-soft": "#6B6259",
        "ink-faint": "#A79C8F",
        line: "#E7DFD3",
        card: "#FFFFFF",
        primary: {
          DEFAULT: "#C96F4A",
          deep: "#A95534",
          soft: "#F5E0D3",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#5F7A61",
          soft: "#E4EDE4",
          foreground: "#FFFFFF",
        },
        amber: "#D9A441",
        "indigo-soft": "#7A86A8",
        error: {
          DEFAULT: "#B4544A",
          soft: "#F6E3E0",
        },
        border: "#E7DFD3",
        input: "#E7DFD3",
        ring: "#C96F4A",
        background: "#FAF6F0",
        foreground: "#2E2A26",
        muted: {
          DEFAULT: "#F3EDE3",
          foreground: "#6B6259",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Songti SC', 'serif'],
        sans: ['"Noto Sans SC"', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        card: "0 1px 2px rgba(46,42,38,0.04), 0 8px 24px rgba(46,42,38,0.06)",
        "card-hover": "0 2px 4px rgba(46,42,38,0.06), 0 16px 40px rgba(46,42,38,0.10)",
        glow: "0 0 0 4px rgba(201,111,74,0.28)",
      },
      borderRadius: {
        xl: "16px",
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      keyframes: {
        "breathe-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "breathe-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(201,111,74,0.28)" },
          "50%": { boxShadow: "0 0 0 6px rgba(201,111,74,0.12)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "breathe-dot": "breathe-dot 1.2s ease-in-out infinite",
        "breathe-glow": "breathe-glow 2s ease-in-out infinite",
        "spin-slow": "spin-slow 1.4s linear infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sentinel: {
          canvas: "var(--canvas)",
          deep: "var(--sidebar)",
          surface: "var(--surface)",
          raised: "var(--surface-raised)",
          soft: "var(--surface-soft)",
          line: "var(--border)",
          "line-strong": "var(--border-strong)",
          border: "var(--border)",
          text: "var(--text)",
          muted: "var(--muted)",
          dim: "var(--muted-2)",
          lime: "var(--accent)", // Theme adaptive: #b7f34a (dark) / #0f766e (light)
          cyan: "var(--accent-cyan)", // Theme adaptive: #2dd4bf (dark) / #0d9488 (light)
          azure: "var(--accent-sky)", // Theme adaptive: #38bdf8 (dark) / #0284c7 (light)
          indigo: "#6366f1",
          emerald: "var(--success)", // Theme adaptive: #10b981 (dark) / #059669 (light)
          accent: "var(--accent)",
          amber: "var(--amber)",
          red: "var(--danger)",
          "brand-lime": "#b7f34a",
          "brand-cyan": "#2dd4bf",
          "brand-sky": "#38bdf8",
        },
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      fontFamily: {
        sentinel: ["var(--font-app)", "Arial", "Helvetica", "sans-serif"],
        mono: ["var(--font-geist-mono)", "SFMono-Regular", "Consolas", "monospace"],
      },
      borderRadius: {
        app: "14px",
        "app-lg": "20px",
      },
      boxShadow: {
        "app-1": "0 1px 2px rgba(2, 6, 23, 0.08)",
        "app-2": "0 18px 50px rgba(2, 6, 23, 0.16)",
      },
      keyframes: {
        "dash-flow": {
          to: { strokeDashoffset: "-48" },
        },
      },
      animation: {
        "dash-flow": "dash-flow 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

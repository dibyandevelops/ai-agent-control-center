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
          lime: "var(--accent)", // Primary accent
          cyan: "var(--accent)",
          azure: "var(--accent)",
          indigo: "#6366f1",
          emerald: "var(--success)",
          amber: "var(--amber)",
          red: "var(--danger)",
        },
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

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sentinel: {
          canvas: "#06090e",
          deep: "#03060a",
          surface: "#0a0f16",
          raised: "#0f1722",
          soft: "#141f2e",
          line: "#1c2838",
          "line-strong": "#2b3c54",
          text: "#f1f5f9",
          muted: "#94a3b8",
          dim: "#64748b",
          lime: "#38bdf8", // Cyber-Azure primary accent
          cyan: "#00f0ff",
          azure: "#38bdf8",
          indigo: "#6366f1",
          emerald: "#10b981",
          amber: "#f59e0b",
          red: "#f43f5e",
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
        "app-1": "0 1px 2px rgba(2, 6, 23, 0.16)",
        "app-2": "0 18px 50px rgba(2, 6, 23, 0.24)",
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

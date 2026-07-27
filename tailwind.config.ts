import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sentinel: {
          canvas: "#080b0f",
          deep: "#05070a",
          surface: "#0d1217",
          raised: "#111820",
          soft: "#151d25",
          line: "#28323c",
          "line-strong": "#3c4854",
          text: "#f4f6f3",
          muted: "#9ca5b0",
          dim: "#6f7985",
          lime: "#b7f34a",
          amber: "#f4bd3c",
          red: "#ff665b",
        },
      },
      fontFamily: {
        sentinel: ["var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "SFMono-Regular", "Consolas", "monospace"],
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

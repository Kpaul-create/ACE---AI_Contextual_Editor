import type { Config } from "tailwindcss";
import { palette, glass } from "./src/tokens";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas:  palette.canvas,
        panel:   palette.panel,
        line:    palette.line,
        accent:  palette.accent,
        "surface-bg":     glass.bgTw,
        "surface-border": glass.borderTw,
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backdropBlur: {
        glass: glass.blurTw,
      },
      boxShadow: {
        glass: glass.shadowTw,
      },
      borderRadius: {
        window: glass.radiusTw,
      },
    },
  },
  plugins: [],
};

export default config;

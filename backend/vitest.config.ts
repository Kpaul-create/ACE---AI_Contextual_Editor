import { defineConfig } from "vitest/config";

export default defineConfig({
  // The repo root has a Tailwind postcss.config.mjs; inline an empty PostCSS
  // config so Vite does not walk up and try to load Tailwind plugins here.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Populates required env vars before any module (env.ts) is imported.
    setupFiles: ["tests/setup.ts"],
  },
});

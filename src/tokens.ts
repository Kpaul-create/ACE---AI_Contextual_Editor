/**
 * Design tokens — single source of truth for every visual value.
 *
 * Consumed by:
 *   - tailwind.config.ts  (theme.extend)
 *   - app/globals.css     (CSS custom properties, via the same string values)
 *
 * Rules:
 *   - No logic here, only data.
 *   - All colours are CSS-compatible strings so they can be pasted into
 *     both JS (Tailwind) and CSS (:root { --x: <value> }) without conversion.
 *   - AA contrast requirement: text on surface must be ≥ 4.5 : 1.
 *     Verified pairs listed in comments.
 */

// ─── Wallpaper ────────────────────────────────────────────────────────────────
export const wallpaper = {
  base: "#1a0a2e",
  gradients: [
    "radial-gradient(ellipse 110% 70% at 0% 0%,   #c2410c55 0%, transparent 50%)",
    "radial-gradient(ellipse 80%  60% at 100% 0%,  #7c3aed50 0%, transparent 55%)",
    "radial-gradient(ellipse 70%  80% at 50%  50%, #1e1b4b   0%, transparent 80%)",
    "radial-gradient(ellipse 60%  50% at 0%   100%,#9d174d40 0%, transparent 55%)",
    "radial-gradient(ellipse 50%  40% at 100% 100%,#ea580c35 0%, transparent 50%)",
  ],
} as const;

// ─── Palette ──────────────────────────────────────────────────────────────────
export const palette = {
  // Base canvas
  background: "#0b0c0e",
  foreground: "#e7e9ec",   // on background: ~12 : 1 ✓
  muted:      "#858a93",   // on background: ~4.6 : 1 ✓

  // Structural
  line:   "#25282d",
  canvas: "#0b0c0e",
  panel:  "#111316",

  // Accent (lime-green)
  accent: "#c6f36b",       // on surface-bg-solid: ~8.2 : 1 ✓

  // Semantic
  success: "#28c840",
  warning: "#febc2e",
  danger:  "#ff5f57",
} as const;

// ─── Glass surface ────────────────────────────────────────────────────────────
export const glass = {
  bg:          "rgba(30, 22, 44, 0.62)",
  bgSolid:     "#1a1525",
  border:      "rgba(255, 255, 255, 0.12)",
  borderBright:"rgba(255, 255, 255, 0.22)",
  blur:        "20px",
  shadow:      "0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset",
  radius:      "0.625rem",

  // Tailwind shorthand equivalents (must match above)
  bgTw:        "rgba(18,20,26,0.55)",
  borderTw:    "rgba(255,255,255,0.10)",
  shadowTw:    "0 8px 32px rgba(0,0,0,0.55), 0 1.5px 0 rgba(255,255,255,0.04) inset",
  blurTw:      "18px",
  radiusTw:    "0.75rem",
} as const;

// ─── Title bar ────────────────────────────────────────────────────────────────
export const titlebar = {
  bg:     "rgba(255, 255, 255, 0.05)",
  height: "1.875rem",
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const font = {
  sans: "Arial, Helvetica, sans-serif",
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
} as const;

// ─── Traffic-light dots ───────────────────────────────────────────────────────
export const trafficLight = {
  close:    palette.danger,
  minimise: palette.warning,
  maximise: palette.success,
} as const;

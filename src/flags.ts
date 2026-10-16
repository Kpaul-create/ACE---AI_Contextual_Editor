/**
 * Feature flags — single source of truth.
 *
 * ALL flags default false. Flipping a flag off must reproduce identical
 * old behaviour. Never read process.env directly in call sites; read flags.
 *
 * Phases:
 *  1  seams          — this file
 *  2  designTokens   — restyle from tokens, zero logic change
 *  3  deployGate     — static export + COOP/COEP + WebContainer hello-world
 *  4  lazyTiles      — <Tile> primitive + custom grid
 *  5  compilePipeline — esbuild-wasm in Worker
 *  6  localMemory    — OPFS + sqlite-wasm + transformers.js
 *  7  p2pCollab      — y-webrtc
 *  8  browserRuntime — @webcontainer/api
 *  9  apiDriver      — BYOK fetch + TS agent loop
 * 10  clientAudit    — axe-core + OSV + PerformanceObserver
 * 11  extensionDriver — Chrome extension BrowserDriver
 * 12  cutOver        — flip all ON, delete server code
 */
export const flags = {
  /** Phase 2 */
  designTokens: true,
  /** Phase 3 */
  deployGate: true,
  /** Phase 4 */
  lazyTiles: true,
  /** Phase 5 */
  compilePipeline: true,
  /** Phase 6 */
  localMemory: true,
  /** Phase 7 */
  p2pCollab: true,
  /** Phase 8 */
  browserRuntime: true,
  /** Phase 9 */
  apiDriver: false,
  tsAgent: false,
  /** Phase 10 */
  clientAudit: false,
  /** Phase 11 */
  extensionDriver: false,
  /** Phase 12 */
  cutOver: false,
} as const;

export type FlagName = keyof typeof flags;

/**
 * Deploy-gate probe — runs in the browser, zero dependencies.
 *
 * Checks:
 *  1. crossOriginIsolated  — COOP + COEP headers are present and correct.
 *                            Required for SharedArrayBuffer / WebContainer.
 *  2. serviceWorker        — available (needed for offline shell in Phase 8).
 *  3. OPFS                 — navigator.storage.getDirectory exists (Phase 6).
 */

export interface ProbeResult {
  crossOriginIsolated: boolean;
  serviceWorker: boolean;
  opfs: boolean;
  /** true when all required checks pass */
  ready: boolean;
}

export function runDeployGateProbe(): ProbeResult {
  const crossOriginIsolated =
    typeof window !== "undefined" && window.crossOriginIsolated === true;

  const serviceWorker =
    typeof navigator !== "undefined" && "serviceWorker" in navigator;

  const opfs =
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function";

  return {
    crossOriginIsolated,
    serviceWorker,
    opfs,
    ready: crossOriginIsolated && serviceWorker,
  };
}

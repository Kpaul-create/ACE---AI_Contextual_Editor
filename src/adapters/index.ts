/**
 * Adapter selection — the ONLY place that reads flags and picks implementations.
 *
 * All call sites import from here, never from a concrete impl file.
 * Swapping an implementation = change one line here + flip a flag.
 *
 * Current state (Phase 1): all flags false → all current impls returned.
 */

import { flags } from "@/src/flags";
import { ServerRuntime, WebContainerRuntime, type WorkspaceRuntime } from "./runtime";
import {
  PuppeteerDriver,
  PuppeteerSessionDriver,
  type BrowserDriver,
  type BrowserSessionDriver,
} from "./driver";
import { RemoteMemory, type MemoryStore } from "./memory";
import { ClientAuth, type AuthProvider } from "./auth";
import {
  NoopCompileDriver,
  EsbuildWorkerDriver,
  type CompileDriver,
} from "./compile";
import { OpfsSqliteMemory } from "./opfs-memory";
import { WebRtcTransport, type CollabTransport } from "./collab";

/* ── Singletons — created once, reused across the app ───────────────────── */

let _runtime: WorkspaceRuntime | null = null;
let _driver: BrowserDriver | null = null;
let _sessionDriver: BrowserSessionDriver | null = null;
let _memory: MemoryStore | null = null;
let _auth: AuthProvider | null = null;
let _compiler: CompileDriver | null = null;
let _collab: CollabTransport | null = null;

export function getRuntime(): WorkspaceRuntime {
  if (!_runtime) {
    // Phase 8: flags.browserRuntime → WebContainerRuntime
    _runtime = flags.browserRuntime
      ? new WebContainerRuntime()
      : new ServerRuntime();
  }
  return _runtime;
}

export function getDriver(): BrowserDriver {
  if (!_driver) {
    // Phase 9:  flags.apiDriver       → ApiDriver
    // Phase 11: flags.extensionDriver → ExtensionDriver (with ApiDriver fallback)
    _driver = new PuppeteerDriver();
  }
  return _driver;
}

export function getSessionDriver(): BrowserSessionDriver {
  if (!_sessionDriver) {
    _sessionDriver = new PuppeteerSessionDriver();
  }
  return _sessionDriver;
}

export function getMemory(): MemoryStore {
  if (!_memory) {
    // Phase 6: flags.localMemory → OpfsSqliteMemory
    _memory = flags.localMemory
      ? new OpfsSqliteMemory()
      : new RemoteMemory();
  }
  return _memory;
}

export function getAuth(): AuthProvider {
  if (!_auth) {
    _auth = new ClientAuth();
  }
  return _auth;
}

export function getCompiler(): CompileDriver {
  if (!_compiler) {
    // Phase 5: flags.compilePipeline → EsbuildWorkerDriver
    _compiler = flags.compilePipeline
      ? new EsbuildWorkerDriver()
      : new NoopCompileDriver();
  }
  return _compiler;
}

export function getCollab(): CollabTransport {
  if (!_collab) {
    // Phase 7: flags.p2pCollab → WebRtcTransport
    _collab = new WebRtcTransport();
  }
  return _collab;
}

/**
 * Reset all singletons — used in tests and when flags change at runtime.
 * In production this is never called.
 */
export function _resetAdapters(): void {
  _runtime = null;
  _driver  = null;
  _sessionDriver = null;
  _memory  = null;
  _auth    = null;
  _compiler = null;
  _collab   = null;
}

/* ── Re-export interfaces so call sites have one import path ─────────────── */
export type { WorkspaceRuntime } from "./runtime";
export type { BrowserDriver, BrowserSessionDriver, CompletionRequest, CompletionEvent, BrowserAction } from "./driver";
export type { MemoryStore, MemoryEntry, RecallOptions } from "./memory";
export type { CollabTransport, CollabPeer } from "./collab";
export type { AuthProvider, Session } from "./auth";
export type { CompileDriver, CompileResult } from "./compile";

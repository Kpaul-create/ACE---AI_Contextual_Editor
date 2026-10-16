/**
 * OpfsSqliteMemory — Phase 6 MemoryStore implementation.
 *
 * Delegates all work to /memory-worker.js which owns:
 *   - sqlite-wasm OPFS database (persistent)
 *   - @huggingface/transformers embedding pipeline
 *
 * Main thread only sends/receives JSON-serialisable messages.
 * Falls back gracefully if the worker fails to initialise.
 */

import type { MemoryStore, MemoryEntry, RecallOptions } from "./memory";

type WorkerMessage =
  | { type: "ready" }
  | { type: "status"; message: string }
  | { type: "error"; message: string }
  | { id: string; result?: unknown; error?: string };

export class OpfsSqliteMemory implements MemoryStore {
  private worker: Worker | null = null;
  private ready = false;
  private readyQueue: Array<() => void> = [];
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private idCounter = 0;

  constructor() {
    if (typeof window === "undefined") return; // SSR guard

    // Module worker so it can use dynamic import()
    this.worker = new Worker("/memory-worker.js", { type: "module" });

    this.worker.onmessage = (event) => {
      const data = event.data as WorkerMessage;

      if ("type" in data) {
        if (data.type === "ready") {
          this.ready = true;
          this.readyQueue.forEach((fn) => fn());
          this.readyQueue = [];
        }
        // status/error messages are informational — no pending to resolve
        return;
      }

      const req = this.pending.get(data.id);
      if (!req) return;
      this.pending.delete(data.id);

      if (data.error) {
        req.reject(new Error(data.error));
      } else {
        req.resolve(data.result);
      }
    };

    this.worker.onerror = () => {
      for (const [, req] of this.pending) {
        req.reject(new Error("memory-worker crashed"));
      }
      this.pending.clear();
    };
  }

  private send<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.worker) return Promise.reject(new Error("Worker unavailable (SSR)"));

    return new Promise<T>((resolve, reject) => {
      const id = String(++this.idCounter);
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });

      const dispatch = () => this.worker!.postMessage({ id, op, ...args });

      if (this.ready) {
        dispatch();
      } else {
        this.readyQueue.push(dispatch);
      }
    });
  }

  remember(content: string, metadata?: Record<string, unknown>): Promise<MemoryEntry> {
    return this.send<MemoryEntry>("remember", { content, metadata });
  }

  recall(options: RecallOptions): Promise<MemoryEntry[]> {
    return this.send<MemoryEntry[]>("recall", {
      query:    options.query,
      topK:     options.topK ?? 5,
      minScore: options.minScore ?? 0.3,
    });
  }

  async consolidate(): Promise<void> {
    await this.send("consolidate");
  }

  async export(): Promise<Blob> {
    const json = await this.send<string>("export");
    return new Blob([json], { type: "application/json" });
  }

  async import(blob: Blob): Promise<void> {
    const json = await blob.text();
    await this.send("import", { json });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
    this.readyQueue = [];
  }
}

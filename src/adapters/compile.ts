/**
 * CompileDriver — interface + implementations.
 *
 * NoopCompileDriver  : returns input unchanged (flags.compilePipeline = false)
 * EsbuildWorkerDriver: compiles via /esbuild-worker.js (flags.compilePipeline = true)
 */

export interface CompileResult {
  output: string;
  errors: string[];
  /** true when compilation succeeded with no errors */
  ok: boolean;
}

export interface CompileDriver {
  /** Compile a single file. Returns a promise that resolves with the result. */
  compile(code: string, filename: string): Promise<CompileResult>;
  /** Dispose the driver (terminates the worker if running). */
  dispose(): void;
}

/* ── NoopCompileDriver ───────────────────────────────────────────────────── */

export class NoopCompileDriver implements CompileDriver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compile(code: string, _filename: string): Promise<CompileResult> {
    return Promise.resolve({ output: code, errors: [], ok: true });
  }
  dispose() { /* nothing to clean up */ }
}

/* ── EsbuildWorkerDriver ─────────────────────────────────────────────────── */

type PendingRequest = {
  resolve: (result: CompileResult) => void;
};

export class EsbuildWorkerDriver implements CompileDriver {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private workerReady = false;
  private readyQueue: Array<() => void> = [];
  private idCounter = 0;

  constructor() {
    if (typeof window === "undefined") return; // SSR guard

    this.worker = new Worker("/esbuild-worker.js");

    this.worker.onmessage = (event) => {
      const data = event.data as
        | { type: "ready" }
        | { type: "error"; message: string }
        | { id: string; output?: string; errors?: string[] };

      if ("type" in data) {
        if (data.type === "ready") {
          this.workerReady = true;
          this.readyQueue.forEach((fn) => fn());
          this.readyQueue = [];
        }
        return;
      }

      const req = this.pending.get(data.id);
      if (!req) return;
      this.pending.delete(data.id);

      const errors = data.errors ?? [];
      req.resolve({
        output: data.output ?? "",
        errors,
        ok: errors.length === 0,
      });
    };

    this.worker.onerror = (err) => {
      // Reject all pending requests on worker crash
      for (const [, req] of this.pending) {
        req.resolve({ output: "", errors: [err.message], ok: false });
      }
      this.pending.clear();
    };
  }

  compile(code: string, filename: string): Promise<CompileResult> {
    if (!this.worker) {
      return Promise.resolve({ output: code, errors: [], ok: true });
    }

    return new Promise((resolve) => {
      const id = String(++this.idCounter);
      this.pending.set(id, { resolve });

      const send = () => this.worker!.postMessage({ id, code, filename });

      if (this.workerReady) {
        send();
      } else {
        this.readyQueue.push(send);
      }
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
    this.readyQueue = [];
  }
}

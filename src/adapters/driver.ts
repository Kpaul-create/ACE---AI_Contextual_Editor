/**
 * BrowserDriver adapter.
 *
 * Abstracts how AI completions are driven.
 * Call sites depend ONLY on this interface.
 *
 * Implementations:
 *   PuppeteerDriver   — current: fetch to /api/v1/editor/complete (SSE)
 *   ApiDriver         — Phase 9: direct BYOK fetch to provider API
 *   ExtensionDriver   — Phase 11: Chrome extension message passing
 */

/* ── Interface ───────────────────────────────────────────────────────────── */

export interface CompletionRequest {
  projectId: string;
  language: string;
  prefix: string;
  suffix: string;
  cursor: { line: number; column: number };
  provider?: string;
  openCodeSessionId?: string;
}

export interface CompletionEvent {
  type: "content" | "context" | "usage" | "done" | "error";
  text?: string;
  error?: string;
  contextBlocks?: unknown[];
  usage?: { promptTokens: number; completionTokens: number };
}

export interface BrowserDriver {
  /**
   * Stream a completion. Yields CompletionEvent until done or error.
   * Caller must handle AbortSignal via the request's signal field.
   */
  complete(
    request: CompletionRequest,
    signal?: AbortSignal,
  ): AsyncIterable<CompletionEvent>;

  /** Tear down — release resources. */
  dispose(): Promise<void>;
}

/* ── PuppeteerDriver — wraps existing /api/v1/editor/complete SSE ────────── */

export class PuppeteerDriver implements BrowserDriver {
  async *complete(
    request: CompletionRequest,
    signal?: AbortSignal,
  ): AsyncIterable<CompletionEvent> {
    const res = await fetch("/api/v1/editor/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        projectId: request.projectId,
        language: request.language,
        prefix: request.prefix,
        suffix: request.suffix,
        cursor: request.cursor,
        provider: request.provider,
        openCodeSessionId: request.openCodeSessionId,
      }),
    });

    if (!res.ok || !res.body) {
      yield {
        type: "error",
        error: `Completion request failed: ${res.status}`,
      };
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          try {
            const event = JSON.parse(raw) as CompletionEvent;
            yield event;
            if (event.type === "done" || event.type === "error") return;
          } catch {
            /* skip malformed frames */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done" };
  }

  async dispose(): Promise<void> {
    // Stateless HTTP — nothing to tear down.
  }
}

/* ── BrowserSessionDriver — wraps existing /api/v1/browser/* calls ───────── */
// These are used by BrowserPane directly; exposed here for future migration.

export interface BrowserSessionDriver {
  createSession(provider: string): Promise<{ contextId: string; authState: string }>;
  screenshot(contextId: string): Promise<Blob | null>;
  action(contextId: string, action: BrowserAction): Promise<{ authState: string }>;
  destroySession(contextId: string): Promise<void>;
}

export type BrowserAction =
  | { type: "click"; x: number; y: number }
  | { type: "type"; text: string }
  | { type: "navigate"; url: string }
  | { type: "key"; key: string };

export class PuppeteerSessionDriver implements BrowserSessionDriver {
  async createSession(
    provider: string,
  ): Promise<{ contextId: string; authState: string }> {
    const res = await fetch("/api/v1/browser/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) throw new Error(`Session init failed: ${res.status}`);
    return res.json() as Promise<{ contextId: string; authState: string }>;
  }

  async screenshot(contextId: string): Promise<Blob | null> {
    const res = await fetch("/api/v1/browser/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextId }),
    });
    if (res.status === 204) return null;
    if (!res.ok) return null;
    return res.blob();
  }

  async action(
    contextId: string,
    action: BrowserAction,
  ): Promise<{ authState: string }> {
    const res = await fetch("/api/v1/browser/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextId, ...action }),
    });
    if (!res.ok) return { authState: "guest" };
    return res.json() as Promise<{ authState: string }>;
  }

  async destroySession(contextId: string): Promise<void> {
    await fetch(`/api/v1/browser/session/${contextId}`, {
      method: "DELETE",
    }).catch(() => null);
  }
}

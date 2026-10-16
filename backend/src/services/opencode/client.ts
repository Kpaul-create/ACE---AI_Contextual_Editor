/**
 * OpenCode agent client.
 *
 * Wraps the OpenCode local agent HTTP API (default: http://localhost:3001).
 * Streams tokens back as CompletionChunk so the editor route can treat it
 * identically to the Grok/Venice path.
 *
 * OpenCode API (minimal surface we need):
 *   POST /session          → { id: string }
 *   POST /session/:id/chat → SSE stream of { type, content } events
 */

import type { CompletionChunk } from "../../types/domain.js";

export interface OpenCodeParams {
  prompt: string;
  sessionId?: string;
  signal?: AbortSignal;
}

function baseUrl(): string {
  return (process.env.OPENCODE_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

/** Create a new OpenCode session and return its id. */
export async function createOpenCodeSession(): Promise<string> {
  const res = await fetch(`${baseUrl()}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`OpenCode session create failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Stream a completion from OpenCode as CompletionChunk. */
export async function* streamOpenCode(
  params: OpenCodeParams,
): AsyncGenerator<CompletionChunk> {
  let sessionId = params.sessionId;
  if (!sessionId) {
    try {
      sessionId = await createOpenCodeSession();
    } catch (err) {
      yield { type: "error", error: `OpenCode session error: ${String(err)}` };
      return;
    }
  }

  const res = await fetch(`${baseUrl()}/session/${sessionId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: params.prompt }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    yield { type: "error", error: `OpenCode chat failed (${res.status}): ${detail.slice(0, 400)}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
        if (raw === "[DONE]") { yield { type: "done" }; return; }
        try {
          const event = JSON.parse(raw) as { type?: string; content?: string; text?: string };
          if (event.type === "content" || event.type === "text") {
            const text = event.content ?? event.text ?? "";
            if (text) yield { type: "content", text };
          } else if (event.type === "done") {
            yield { type: "done" };
            return;
          } else if (event.type === "error") {
            yield { type: "error", error: String(event.content ?? "OpenCode error") };
            return;
          }
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

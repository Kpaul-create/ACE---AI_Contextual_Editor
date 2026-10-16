import type { ServerResponse } from "node:http";
import type { CompletionChunk } from "../../types/domain";

/**
 * SSE serialization for the streaming completion route.
 *
 * We write directly to the raw Node response so the token stream is never
 * buffered by a framework serializer. `X-Accel-Buffering: no` keeps proxies
 * (nginx, some serverless edges) from coalescing tokens and breaking the
 * typewriter effect in the editor.
 */

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export function writeSseEvent(res: ServerResponse, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** Serialize an async generator of CompletionChunk to an SSE response. */
export async function pipeCompletionToSse(
  res: ServerResponse,
  stream: AsyncGenerator<CompletionChunk>,
  options: { heartbeatMs?: number } = {},
): Promise<void> {
  const heartbeatMs = options.heartbeatMs ?? 15_000;
  let closed = false;

  res.on("close", () => {
    closed = true;
  });

  const heartbeat = setInterval(() => {
    if (!closed) res.write(": ping\n\n");
  }, heartbeatMs);

  try {
    for await (const chunk of stream) {
      if (closed) break;
      writeSseEvent(res, chunk);
    }
    if (!closed) writeSseEvent(res, { type: "done" });
  } catch (err) {
    if (!closed) {
      writeSseEvent(res, {
        type: "error",
        error: err instanceof Error ? err.message : "Unknown streaming error",
      });
    }
  } finally {
    clearInterval(heartbeat);
    if (!closed) res.end();
  }
}

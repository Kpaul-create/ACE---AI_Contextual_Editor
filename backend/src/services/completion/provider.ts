import { env } from "../../config/env";
import type { CompletionChunk } from "../../types/domain";
import { resolveFimModel, type FimModel } from "../rag/fimModel";

/**
 * provider.ts — provider-agnostic CLM/FIM inference boundary.
 *
 * All three targets (OpenAI, DeepInfra, Anthropic) are addressed over their
 * streaming HTTP APIs with a small hand-rolled SSE reader, so there is no heavy
 * SDK between us and the token stream. Providers are normalized to a single
 * async generator of CompletionChunk, which the API layer serializes as SSE.
 */

export interface CompletionParams {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stop?: string[];
  signal?: AbortSignal;
}

function resolveModel(): FimModel {
  return resolveFimModel(env.COMPLETION_MODEL);
}

function baseUrlFor(provider: FimModel["provider"]): string {
  if (env.COMPLETION_BASE_URL) return env.COMPLETION_BASE_URL.replace(/\/$/, "");
  switch (provider) {
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "deepinfra":
    default:
      return "https://api.deepinfra.com/v1/openai";
  }
}

/** Parse an SSE byte stream into successive JSON payloads. */
async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown> | "[DONE]"> {
  const reader = body.getReader();
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
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          yield "[DONE]";
          return;
        }
        try {
          yield JSON.parse(data) as Record<string, unknown>;
        } catch {
          // Ignore non-JSON keep-alive frames.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* streamOpenAiCompatible(
  params: CompletionParams,
  model: FimModel,
): AsyncGenerator<CompletionChunk> {
  const res = await fetch(`${baseUrlFor(model.provider)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.COMPLETION_API_KEY}`,
    },
    body: JSON.stringify({
      model: params.model ?? model.id,
      stream: true,
      temperature: params.temperature ?? env.COMPLETION_TEMPERATURE,
      max_tokens: params.maxTokens ?? env.COMPLETION_MAX_TOKENS,
      stop: params.stop ?? model.stop,
      messages: [
        {
          role: "system",
          content:
            "You are a precise code completion engine. Return only the code that " +
            "belongs at the cursor; never repeat the prefix or suffix.",
        },
        { role: "user", content: params.prompt },
      ],
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    yield { type: "error", error: `Completion failed (${res.status}): ${detail.slice(0, 500)}` };
    return;
  }

  for await (const event of readSse(res.body)) {
    if (event === "[DONE]") break;
    const choice = (event.choices as Array<{ delta?: { content?: string } }> | undefined)?.[0];
    const text = choice?.delta?.content;
    if (text) yield { type: "content", text };
    const usage = event.usage as
      | { prompt_tokens?: number; completion_tokens?: number }
      | undefined;
    if (usage) {
      yield {
        type: "usage",
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
        },
      };
    }
  }
  yield { type: "done" };
}

async function* streamAnthropic(
  params: CompletionParams,
  model: FimModel,
): AsyncGenerator<CompletionChunk> {
  const res = await fetch(`${baseUrlFor("anthropic")}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.COMPLETION_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model ?? model.id,
      stream: true,
      max_tokens: params.maxTokens ?? env.COMPLETION_MAX_TOKENS,
      temperature: params.temperature ?? env.COMPLETION_TEMPERATURE,
      stop_sequences: params.stop ?? model.stop,
      messages: [{ role: "user", content: params.prompt }],
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    yield { type: "error", error: `Completion failed (${res.status}): ${detail.slice(0, 500)}` };
    return;
  }

  for await (const event of readSse(res.body)) {
    if (event === "[DONE]") break;
    const type = event.type as string | undefined;
    if (type === "content_block_delta") {
      const delta = event.delta as { text?: string } | undefined;
      if (delta?.text) yield { type: "content", text: delta.text };
    } else if (type === "message_delta") {
      const usage = event.usage as { output_tokens?: number } | undefined;
      if (usage) {
        yield { type: "usage", usage: { promptTokens: 0, completionTokens: usage.output_tokens ?? 0 } };
      }
    } else if (type === "message_stop") {
      break;
    }
  }
  yield { type: "done" };
}

export function streamCompletion(
  params: CompletionParams,
): AsyncGenerator<CompletionChunk> {
  const model = resolveModel();
  return model.provider === "anthropic"
    ? streamAnthropic(params, model)
    : streamOpenAiCompatible(params, model);
}

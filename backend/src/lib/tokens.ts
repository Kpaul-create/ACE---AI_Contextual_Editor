/**
 * Token accounting shared by the chunker, retriever, and FIM formatter.
 *
 * We intentionally avoid a native tokenizer dependency: code is dense and the
 * ~4 chars/token heuristic is close enough for *budgeting*, while remaining
 * deterministic and fast. Swap in `tiktoken` or a model-specific encoder here
 * if exact counts are ever required — every consumer routes through this file.
 */

const CHARS_PER_TOKEN = 4;

export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Approximate token count for a message payload (adds chat-frame overhead). */
export function countMessageTokens(text: string, overhead = 4): number {
  return countTokens(text) + overhead;
}

/**
 * Truncate `text` so it fits within `maxTokens`, keeping the supplied end.
 * `end = "tail"` keeps the tail (good for prefixes near a cursor),
 * `end = "head"` keeps the head (good for suffixes with a visible start).
 */
export function truncateToTokens(
  text: string,
  maxTokens: number,
  end: "head" | "tail" = "tail",
): string {
  if (maxTokens <= 0) return "";
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return end === "tail" ? text.slice(text.length - maxChars) : text.slice(0, maxChars);
}

/**
 * Greedily pack ordered items into a token budget.
 * Returns the accepted items plus the total token cost, so callers can report
 * exactly how much of the window the retrieval context consumed.
 */
export function packToBudget<T>(
  items: readonly T[],
  costOf: (item: T) => number,
  budget: number,
): { accepted: T[]; tokens: number } {
  const accepted: T[] = [];
  let tokens = 0;
  for (const item of items) {
    const cost = Math.max(0, costOf(item));
    if (tokens + cost > budget) break;
    accepted.push(item);
    tokens += cost;
  }
  return { accepted, tokens };
}

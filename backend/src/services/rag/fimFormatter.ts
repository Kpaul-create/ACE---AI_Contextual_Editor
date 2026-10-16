import { env } from "../../config/env";
import { countTokens, truncateToTokens } from "../../lib/tokens";
import type { FimContextBlock, FimPayload } from "../../types/domain";
import { resolveFimModel, type FimModel } from "./fimModel";

/**
 * fimFormatter.ts — the ONLY bridge between retrieval and the language model.
 *
 * It takes the raw prefix/suffix around the cursor plus retrieved context
 * blocks and emits a model-ready FIM prompt:
 *
 *   <related retrieved code, as commented context>
 *   <prefix token> …prefix… <suffix token> …suffix… <middle token>
 *
 * The model then completes the "middle". Everything here is about *inference
 * quality*: reserve budget for the suffix, keep the text nearest the cursor,
 * escape control tokens so code cannot forge FIM sentinels, and order context so
 * the most relevant chunk sits closest to the hole.
 */

export interface FormatOptions {
  prefix: string;
  suffix: string;
  context: FimContextBlock[];
  language: string;
  /** Optional user instruction appended to the context preamble. */
  instruction?: string;
  tokenBudget?: number;
  model?: FimModel;
}

export interface FormatResult extends FimPayload {}

const CONTEXT_FENCE = {
  open: (lang: string) => `\`\`\`${lang}`,
  close: "```",
};

/** Strip any control token that appears inside untrusted code/text. */
function sanitize(text: string, model: FimModel): string {
  const sentinels = [
    model.tokens.prefix,
    model.tokens.suffix,
    model.tokens.middle,
    model.tokens.eot,
    ...model.stop,
  ];
  let out = text;
  for (const s of sentinels) {
    if (s) out = out.split(s).join("");
  }
  return out;
}

function renderContext(
  blocks: FimContextBlock[],
  language: string,
  instruction: string | undefined,
  model: FimModel,
): string {
  if (blocks.length === 0 && !instruction) return "";

  const parts: string[] = [];
  parts.push("// --- Retrieved workspace context (for reference only) ---");
  if (instruction) parts.push(`// Task: ${instruction}`);

  // Highest-scoring block last => nearest the hole.
  for (const block of [...blocks].reverse()) {
    const label = block.symbol
      ? `${block.fileId}#${block.symbol}`
      : `${block.fileId}:${block.kind}`;
    parts.push(`// ${label} (score ${block.score.toFixed(3)}, ${block.reason})`);
    parts.push(CONTEXT_FENCE.open(language));
    parts.push(sanitize(block.content, model));
    parts.push(CONTEXT_FENCE.close);
  }
  parts.push("// --- End retrieved context ---");
  return parts.join("\n");
}

export function formatFimPrompt(options: FormatOptions): FormatResult {
  const {
    prefix,
    suffix,
    context,
    language,
    instruction,
    tokenBudget = env.RAG_TOKEN_BUDGET,
    model = resolveFimModel(env.COMPLETION_MODEL),
  } = options;

  const contextText = sanitize(
    renderContext(context, language, instruction, model),
    model,
  );
  const contextTokens = countTokens(contextText);

  // Reserve room for the context preamble, both cursor sides, and the middle
  // control token. Prefix may keep its tail (nearest the cursor); suffix keeps
  // its head.
  const middleTokenCost = countTokens(model.tokens.prefix + model.tokens.suffix + model.tokens.middle);
  const budgetForSides = Math.max(
    0,
    tokenBudget - contextTokens - middleTokenCost,
  );
  // 60/40 split favouring the prefix — it carries the most signal.
  const prefixBudget = Math.floor(budgetForSides * 0.6);
  const suffixBudget = budgetForSides - prefixBudget;

  const safePrefix = truncateToTokens(sanitize(prefix, model), prefixBudget, "tail");
  const safeSuffix = truncateToTokens(sanitize(suffix, model), suffixBudget, "head");

  const fimSequence =
    model.tokens.prefix + safePrefix + model.tokens.suffix + safeSuffix + model.tokens.middle;

  const prompt = contextText ? `${contextText}\n${fimSequence}` : fimSequence;

  const prefixTokens = countTokens(safePrefix);
  const suffixTokens = countTokens(safeSuffix);
  const totalTokens = countTokens(prompt);

  return {
    prompt,
    tokens: model.tokens,
    contextBlocks: context,
    stats: {
      prefixTokens,
      suffixTokens,
      contextTokens,
      totalTokens,
      budget: tokenBudget,
      model: model.id,
    },
  };
}

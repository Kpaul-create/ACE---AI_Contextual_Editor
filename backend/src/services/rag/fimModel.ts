import type { FimTokens } from "../../types/domain";

/**
 * Capability registry for Causal Language Models exposed with Fill-in-the-Middle
 * endpoints. The formatter reads this to pick the right control tokens, stop
 * sequences, and context budget — so adding a model never edits request logic.
 */

export type CompletionProvider = "openai" | "anthropic" | "deepinfra";

export interface FimModel {
  /** Provider-facing model id. */
  id: string;
  provider: CompletionProvider;
  /** Whether the endpoint natively supports FIM (prefix/suffix) requests. */
  supportsFim: boolean;
  /** Total usable context window. */
  contextWindow: number;
  /** Max tokens we will ask the model to generate. */
  maxOutput: number;
  tokens: FimTokens;
  /** Sequences that terminate generation. */
  stop: string[];
  /**
   * "tokens"  => inline the control tokens into a single prompt string.
   * "native"  => send prefix/suffix as separate API fields (no inline tokens).
   */
  fimStyle: "tokens" | "native";
}

const STARCODER_TOKENS: FimTokens = {
  prefix: "<fim_prefix>",
  suffix: "<fim_suffix>",
  middle: "<fim_middle>",
  eot: "<|endoftext|>",
};

const OPENAI_TOKENS: FimTokens = {
  prefix: "<|fim_prefix|>",
  suffix: "<|fim_suffix|>",
  middle: "<|fim_middle|>",
  eot: "<|endoftext|>",
};

// DeepSeek-Coder uses full-width vertical bars around the control words.
const DEEPSEEK_TOKENS: FimTokens = {
  prefix: "<\uFF5Cfim\u2581begin\uFF5C>",
  suffix: "<\uFF5Cfim\u2581hole\uFF5C>",
  middle: "<\uFF5Cfim\u2581end\uFF5C>",
  eot: "<\uFF5Cend\u2581of\u2581sentence\uFF5C>",
};

// Codestral/Mistral FIM uses bracketed sentinels.
const CODESTRAL_TOKENS: FimTokens = {
  prefix: "[PREFIX]",
  suffix: "[SUFFIX]",
  middle: "[MIDDLE]",
  eot: "</s>",
};

const REGISTRY: FimModel[] = [
  {
    id: "deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct",
    provider: "deepinfra",
    supportsFim: true,
    contextWindow: 163_840,
    maxOutput: 512,
    tokens: DEEPSEEK_TOKENS,
    stop: ["<\uFF5Cfim\u2581begin\uFF5C>"],
    fimStyle: "tokens",
  },
  {
    id: "deepseek-ai/DeepSeek-Coder-V2-Instruct",
    provider: "deepinfra",
    supportsFim: true,
    contextWindow: 163_840,
    maxOutput: 512,
    tokens: DEEPSEEK_TOKENS,
    stop: ["<\uFF5Cfim\u2581begin\uFF5C>"],
    fimStyle: "tokens",
  },
  {
    id: "codestral-latest",
    provider: "deepinfra",
    supportsFim: true,
    contextWindow: 32_768,
    maxOutput: 512,
    tokens: CODESTRAL_TOKENS,
    stop: ["[PREFIX]", "[SUFFIX]"],
    fimStyle: "tokens",
  },
  {
    id: "bigcode/starcoder2-15b",
    provider: "deepinfra",
    supportsFim: true,
    contextWindow: 16_384,
    maxOutput: 512,
    tokens: STARCODER_TOKENS,
    stop: ["<fim_prefix>", "<fim_suffix>", "<|endoftext|>"],
    fimStyle: "tokens",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    supportsFim: false, // chat model: FIM is emulated by the formatter's framing
    contextWindow: 128_000,
    maxOutput: 512,
    tokens: OPENAI_TOKENS,
    stop: ["<|fim_middle|>", "<|endoftext|>"],
    fimStyle: "tokens",
  },
  {
    id: "claude-3-5-sonnet-latest",
    provider: "anthropic",
    supportsFim: false,
    contextWindow: 200_000,
    maxOutput: 512,
    tokens: {
      prefix: "<fim_prefix>",
      suffix: "<fim_suffix>",
      middle: "<fim_middle>",
      eot: "</antml:invoke>",
    },
    stop: ["<fim_prefix>", "<fim_suffix>"],
    fimStyle: "tokens",
  },
];

const DEFAULT_MODEL: FimModel = {
  id: "generic-fim",
  provider: "deepinfra",
  supportsFim: true,
  contextWindow: 16_384,
  maxOutput: 512,
  tokens: STARCODER_TOKENS,
  stop: ["<fim_prefix>", "<fim_suffix>"],
  fimStyle: "tokens",
};

/** Resolve a configured model id to its capability descriptor. */
export function resolveFimModel(modelId: string): FimModel {
  const match = REGISTRY.find((m) => m.id === modelId);
  if (match) return match;
  return { ...DEFAULT_MODEL, id: modelId };
}

/** Register additional models at runtime (e.g. from a config service). */
export function registerFimModel(model: FimModel): void {
  const idx = REGISTRY.findIndex((m) => m.id === model.id);
  if (idx >= 0) REGISTRY[idx] = model;
  else REGISTRY.push(model);
}

export function listFimModels(): FimModel[] {
  return [...REGISTRY];
}

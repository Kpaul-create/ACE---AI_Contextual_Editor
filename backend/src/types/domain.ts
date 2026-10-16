/**
 * Shared domain contracts. These are transport-agnostic: repositories, the RAG
 * services, and the HTTP schemas all speak these shapes.
 */

export type OnboardingStatus = "pending" | "completed";

export interface Profile {
  id: string; // Clerk user id
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  onboarding_status: OnboardingStatus;
  preferences: WorkspacePreferences;
}

export interface WorkspacePreferences {
  theme: "dark" | "light";
  primaryLanguage: string;
  editor?: {
    fontSize?: number;
    tabSize?: number;
    keymap?: "default" | "vim";
  };
  [key: string]: unknown;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  language: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FileRecord {
  id: string;
  project_id: string;
  path: string;
  language: string;
  content: string;
  content_hash: string;
  size_bytes: number;
  version: number;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A single retrieval unit produced by the chunker and stored in file_chunks. */
export interface CodeChunk {
  id: string;
  file_id: string;
  project_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  start_line: number;
  end_line: number;
  symbol: string | null;
  kind: ChunkKind;
  metadata: ChunkMetadata;
  embedding?: number[] | null;
  similarity?: number;
}

export type ChunkKind =
  | "header"
  | "import"
  | "function"
  | "class"
  | "block"
  | "comment";

export interface ChunkMetadata {
  language: string;
  /** Symbols this chunk imports/uses, used for graph expansion during retrieval. */
  imports?: string[];
  /** Symbols defined by this chunk (functions, classes). */
  defines?: string[];
  filePath?: string;
  contentHash?: string;
  [key: string]: unknown;
}

/** The cursor position emitted by Monaco, 1-based line / column. */
export interface CursorPosition {
  line: number;
  column: number;
}

export interface FimRequest {
  projectId: string;
  fileId?: string;
  language: string;
  prefix: string;
  suffix: string;
  cursor: CursorPosition;
  /** Optional natural-language intent, e.g. "add a debounce helper". */
  instruction?: string;
}

export interface FimContextBlock {
  fileId: string;
  symbol: string | null;
  kind: ChunkKind;
  content: string;
  tokenCount: number;
  score: number;
  reason: "semantic" | "lexical" | "graph";
}

export interface FimPayload {
  /** Fully assembled, model-ready prompt. */
  prompt: string;
  tokens: FimTokens;
  contextBlocks: FimContextBlock[];
  stats: {
    prefixTokens: number;
    suffixTokens: number;
    contextTokens: number;
    totalTokens: number;
    budget: number;
    model: string;
  };
}

/**
 * FIM control tokens, normalized to prefix/suffix/middle. Different tokenizers
 * name these differently (OpenAI: <|fim_prefix|>/<|fim_suffix|>/<|fim_middle|>;
 * DeepSeek: <|fim_begin|>/<|fim_hole|>/<|fim_end|>), but the layout is the same.
 */
export interface FimTokens {
  prefix: string;
  suffix: string;
  middle: string;
  eot: string;
}

export interface CompletionChunk {
  type: "content" | "context" | "usage" | "done" | "error";
  text?: string;
  contextBlocks?: FimContextBlock[];
  usage?: { promptTokens: number; completionTokens: number };
  error?: string;
}

import { env } from "../../config/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CodeChunk, FimContextBlock } from "../../types/domain";
import { getEmbedder } from "./embedder";
import { packToBudget } from "../../lib/tokens";

/**
 * retriever.ts — "R" of RAG 2.0.
 *
 * Retrieval is not a single vector query. We run semantic (pgvector) and
 * lexical (trigram) searches in parallel, fuse them with Reciprocal Rank
 * Fusion, optionally expand across the import graph, then pack the winners into
 * the FIM token budget. Every returned block carries the reason it was kept, so
 * the formatter and telemetry can explain what the model actually saw.
 */

export interface RetrieveOptions {
  projectId: string;
  /** Text used to form the query embedding (cursor neighbourhood + intent). */
  query: string;
  /** Chunks defining these symbols are pulled in even if only lexically weak. */
  graphSymbols?: string[];
  /** Hard cap on context tokens handed to the FIM formatter. */
  tokenBudget?: number;
  matchCount?: number;
  lexicalCount?: number;
  minSimilarity?: number;
}

type RankedRow = {
  id: string;
  file_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  symbol: string | null;
  kind: CodeChunk["kind"];
  metadata: Record<string, unknown>;
  similarity: number;
};

/** Reciprocal Rank Fusion: rank-based so the two scorers need not be calibrated. */
function fuse(
  semantic: RankedRow[],
  lexical: RankedRow[],
  k: number,
): Map<string, { row: RankedRow; score: number; reason: FimContextBlock["reason"] }> {
  const fused = new Map<string, { row: RankedRow; score: number; reason: FimContextBlock["reason"] }>();

  const contribute = (rows: RankedRow[], reason: "semantic" | "lexical") => {
    rows.forEach((row, rank) => {
      const add = 1 / (k + rank + 1);
      const existing = fused.get(row.id);
      if (existing) {
        existing.score += add;
      } else {
        fused.set(row.id, { row, score: add, reason });
      }
    });
  };

  contribute(semantic, "semantic");
  contribute(lexical, "lexical");
  return fused;
}

export async function retrieveContext(
  db: SupabaseClient,
  options: RetrieveOptions,
): Promise<FimContextBlock[]> {
  const {
    projectId,
    query,
    graphSymbols = [],
    tokenBudget = env.RAG_TOKEN_BUDGET,
    matchCount = env.RAG_MATCH_COUNT,
    lexicalCount = env.RAG_LEXICAL_COUNT,
    minSimilarity = env.RAG_MIN_SIMILARITY,
  } = options;

  const embedder = getEmbedder();
  const queryEmbedding = await embedder.embedOne(query);

  // Run both retrievals concurrently; a lexical outage must not kill the request.
  const [semanticRes, lexicalRes] = await Promise.all([
    db.rpc("match_file_chunks", {
      p_project_id: projectId,
      p_query_embedding: queryEmbedding,
      p_match_count: matchCount,
      p_min_similarity: minSimilarity,
    }),
    db.rpc("search_file_chunks_lexical", {
      p_project_id: projectId,
      p_query: query.slice(0, 500),
      p_match_count: lexicalCount,
    }),
  ]);

  if (semanticRes.error) {
    throw new Error(`Semantic retrieval failed: ${semanticRes.error.message}`);
  }
  if (lexicalRes.error) {
    // Degrade gracefully: semantic-only results are still useful.
    // eslint-disable-next-line no-console
    console.warn(`[retriever] lexical retrieval degraded: ${lexicalRes.error.message}`);
  }

  const semantic = (semanticRes.data ?? []) as RankedRow[];
  const lexical = (lexicalRes.data ?? []) as RankedRow[];
  const fused = fuse(semantic, lexical, env.RRF_K);

  // Graph expansion: force-include chunks that define a requested symbol.
  if (graphSymbols.length > 0) {
    const { data: graphRows } = await db
      .from("file_chunks")
      .select("id, file_id, chunk_index, content, token_count, symbol, kind, metadata")
      .eq("project_id", projectId)
      .in("symbol", graphSymbols)
      .limit(matchCount);

    for (const row of (graphRows ?? []) as RankedRow[]) {
      const existing = fused.get(row.id);
      if (existing) {
        existing.score += 0.5;
        existing.reason = "graph";
      } else {
        fused.set(row.id, { row: { ...row, similarity: 0 }, score: 0.5, reason: "graph" });
      }
    }
  }

  const ranked = [...fused.values()].sort((a, b) => b.score - a.score);

  const { accepted, tokens } = packToBudget(
    ranked,
    (entry) => entry.row.token_count || Math.ceil(entry.row.content.length / 4),
    tokenBudget,
  );

  // eslint-disable-next-line no-console
  console.debug(
    `[retriever] project=${projectId} semantic=${semantic.length} lexical=${lexical.length} ` +
      `fused=${ranked.length} accepted=${accepted.length} tokens=${tokens}/${tokenBudget}`,
  );

  return accepted.map((entry) => ({
    fileId: entry.row.file_id,
    symbol: entry.row.symbol,
    kind: entry.row.kind,
    content: entry.row.content,
    tokenCount: entry.row.token_count || Math.ceil(entry.row.content.length / 4),
    score: entry.score,
    reason: entry.reason,
  }));
}

/**
 * Build the retrieval query from the local cursor neighbourhood. We bias toward
 * the text immediately before the cursor plus any explicit user instruction.
 */
export function buildRetrievalQuery(
  prefix: string,
  suffix: string,
  instruction?: string,
): string {
  const before = prefix.slice(-800);
  const after = suffix.slice(0, 400);
  return [instruction ?? "", before, after].filter(Boolean).join("\n");
}

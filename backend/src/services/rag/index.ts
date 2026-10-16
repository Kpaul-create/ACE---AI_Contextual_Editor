import type { SupabaseClient } from "@supabase/supabase-js";
import type { FimPayload } from "../../types/domain";
import { getEmbedder } from "./embedder";
import { chunkCode, type ChunkDraft } from "./chunker";
import { buildRetrievalQuery, retrieveContext } from "./retriever";
import { formatFimPrompt } from "./fimFormatter";
import { resolveFimModel } from "./fimModel";
import { env } from "../../config/env";

/**
 * RAG 2.0 façade.
 *
 * This is the seam the API layer talks to: given a cursor, produce a fully
 * assembled FIM payload. Retrieval and generation are co-designed here — the
 * retriever's output shape is exactly what the formatter consumes, with no
 * lossy serialization in between.
 */

export interface AssembleInput {
  projectId: string;
  language: string;
  prefix: string;
  suffix: string;
  instruction?: string;
  /** Symbols immediately in scope, used for import-graph expansion. */
  graphSymbols?: string[];
  tokenBudget?: number;
}

export interface AssembleResult extends FimPayload {
  query: string;
}

export async function assembleRetrievalContext(
  db: SupabaseClient,
  input: AssembleInput,
): Promise<AssembleResult> {
  const model = resolveFimModel(env.COMPLETION_MODEL);
  const tokenBudget = input.tokenBudget ?? Math.min(env.RAG_TOKEN_BUDGET, model.contextWindow - model.maxOutput);

  const query = buildRetrievalQuery(input.prefix, input.suffix, input.instruction);
  const context = await retrieveContext(db, {
    projectId: input.projectId,
    query,
    graphSymbols: input.graphSymbols,
    tokenBudget: Math.floor(tokenBudget * 0.5), // leave half the window for cursor code
  });

  const formatted = formatFimPrompt({
    prefix: input.prefix,
    suffix: input.suffix,
    context,
    language: input.language,
    instruction: input.instruction,
    tokenBudget,
    model,
  });

  return { ...formatted, query };
}

/**
 * Indexing pipeline: chunk -> embed -> persist. Called by the async job on file
 * save (or synchronously by the file route for small files). Idempotent per
 * file: existing chunks are replaced.
 */
export async function indexFile(
  db: SupabaseClient,
  params: {
    fileId: string;
    projectId: string;
    path: string;
    language: string;
    content: string;
    contentHash: string;
  },
): Promise<number> {
  const drafts: ChunkDraft[] = chunkCode(params.content, {
    language: params.language,
    filePath: params.path,
    contentHash: params.contentHash,
    maxTokens: env.CHUNK_MAX_TOKENS,
    overlapTokens: env.CHUNK_OVERLAP_TOKENS,
  });

  if (drafts.length === 0) {
    await db.from("file_chunks").delete().eq("file_id", params.fileId);
    return 0;
  }

  const embedder = getEmbedder();
  const embeddings = await embedder.embed(drafts.map((d) => d.content));

  const rows = drafts.map((d, i) => ({
    file_id: params.fileId,
    project_id: params.projectId,
    chunk_index: d.chunkIndex,
    content: d.content,
    token_count: d.tokenCount,
    start_line: d.startLine,
    end_line: d.endLine,
    symbol: d.symbol,
    kind: d.kind,
    metadata: d.metadata,
    embedding: embeddings[i],
  }));

  // Replace-atomically: delete then insert. A failed insert leaves the file
  // stale rather than half-indexed, and `indexed_at` is only bumped on success.
  const del = await db.from("file_chunks").delete().eq("file_id", params.fileId);
  if (del.error) throw new Error(`Failed clearing old chunks: ${del.error.message}`);

  const ins = await db.from("file_chunks").insert(rows);
  if (ins.error) throw new Error(`Failed inserting chunks: ${ins.error.message}`);

  await db
    .from("files")
    .update({ indexed_at: new Date().toISOString() })
    .eq("id", params.fileId);

  return rows.length;
}

export { chunkCode } from "./chunker";
export { retrieveContext, buildRetrievalQuery } from "./retriever";
export { formatFimPrompt } from "./fimFormatter";
export { resolveFimModel, listFimModels } from "./fimModel";
export { getEmbedder } from "./embedder";

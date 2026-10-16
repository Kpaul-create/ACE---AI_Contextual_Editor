import { env } from "../../config/env";

/**
 * Batched embedding client for any OpenAI-compatible /embeddings endpoint
 * (OpenAI, DeepInfra, Together, local vLLM...). Kept deliberately thin: the
 * only job is turning text into normalized dense vectors in batches.
 */

export interface Embedder {
  readonly model: string;
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
  embedOne(text: string): Promise<number[]>;
}

export class OpenAiCompatibleEmbedder implements Embedder {
  readonly model = env.EMBEDDING_MODEL;
  readonly dim = env.EMBEDDING_DIM;

  constructor(
    private readonly apiKey: string = env.EMBEDDING_API_KEY,
    private readonly baseUrl: string = env.EMBEDDING_BASE_URL.replace(/\/$/, ""),
    private readonly batchSize: number = env.EMBEDDING_BATCH_SIZE,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const out: number[][] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: batch }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Embedding request failed (${res.status}): ${body.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      // Providers do not guarantee ordering; restore by index.
      const ordered = [...json.data].sort((a, b) => a.index - b.index);
      for (const item of ordered) {
        if (item.embedding.length !== this.dim) {
          throw new Error(
            `Embedding dim mismatch: expected ${this.dim}, got ${item.embedding.length}. ` +
              `Check EMBEDDING_DIM against the model and the vector(1536) column.`,
          );
        }
        out.push(item.embedding);
      }
    }

    return out;
  }

  async embedOne(text: string): Promise<number[]> {
    const [vec] = await this.embed([text]);
    if (!vec) throw new Error("Embedding provider returned no vector");
    return vec;
  }
}

let singleton: Embedder | null = null;

export function getEmbedder(): Embedder {
  if (!singleton) singleton = new OpenAiCompatibleEmbedder();
  return singleton;
}

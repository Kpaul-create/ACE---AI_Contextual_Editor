/**
 * MemoryStore adapter.
 *
 * Abstracts where agent memories and embeddings live.
 * Call sites depend ONLY on this interface.
 *
 * Implementations:
 *   RemoteMemory      — current: no-op (files live in Zustand RAM)
 *   OpfsSqliteMemory  — Phase 6: OPFS + sqlite-wasm + sqlite-vec + transformers.js
 */

/* ── Interface ───────────────────────────────────────────────────────────── */

export interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface RecallOptions {
  query: string;
  topK?: number;
  /** Minimum cosine similarity 0–1 */
  minScore?: number;
}

export interface MemoryStore {
  /** Persist a memory entry. Returns the stored entry with id. */
  remember(content: string, metadata?: Record<string, unknown>): Promise<MemoryEntry>;

  /** Semantic recall — returns topK entries by similarity. */
  recall(options: RecallOptions): Promise<MemoryEntry[]>;

  /** Re-embed and compact stale entries. */
  consolidate(): Promise<void>;

  /** Export all entries as a portable JSON blob. */
  export(): Promise<Blob>;

  /** Import from a previously exported blob. Merges, does not replace. */
  import(blob: Blob): Promise<void>;
}

/* ── RemoteMemory — no-op, preserves current behaviour exactly ───────────── */

export class RemoteMemory implements MemoryStore {
  private entries: MemoryEntry[] = [];

  async remember(
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: Math.random().toString(36).slice(2),
      content,
      metadata,
      createdAt: Date.now(),
    };
    this.entries.push(entry);
    return entry;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async recall(_options: RecallOptions): Promise<MemoryEntry[]> {
    // No embeddings in RemoteMemory — return nothing.
    return [];
  }

  async consolidate(): Promise<void> {
    // No-op.
  }

  async export(): Promise<Blob> {
    return new Blob([JSON.stringify(this.entries)], {
      type: "application/json",
    });
  }

  async import(blob: Blob): Promise<void> {
    try {
      const text    = await blob.text();
      const entries = JSON.parse(text) as MemoryEntry[];
      // Merge by id — deduplicate.
      const existing = new Set(this.entries.map((e) => e.id));
      for (const entry of entries) {
        if (!existing.has(entry.id)) this.entries.push(entry);
      }
    } catch {
      throw new Error("MemoryStore.import: invalid blob format.");
    }
  }
}

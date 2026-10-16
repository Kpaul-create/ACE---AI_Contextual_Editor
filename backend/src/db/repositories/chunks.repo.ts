import type { SupabaseClient } from "@supabase/supabase-js";

/** Lightweight introspection helpers for public.file_chunks. */
export class ChunksRepo {
  constructor(private readonly db: SupabaseClient) {}

  async countByFile(fileId: string): Promise<number> {
    const { count, error } = await this.db
      .from("file_chunks")
      .select("id", { count: "exact", head: true })
      .eq("file_id", fileId);
    if (error) throw new Error(`chunks.countByFile failed: ${error.message}`);
    return count ?? 0;
  }

  async listByFile(fileId: string) {
    const { data, error } = await this.db
      .from("file_chunks")
      .select("id, chunk_index, symbol, kind, token_count, start_line, end_line")
      .eq("file_id", fileId)
      .order("chunk_index", { ascending: true });
    if (error) throw new Error(`chunks.listByFile failed: ${error.message}`);
    return data ?? [];
  }

  async deleteByFile(fileId: string): Promise<void> {
    const { error } = await this.db.from("file_chunks").delete().eq("file_id", fileId);
    if (error) throw new Error(`chunks.deleteByFile failed: ${error.message}`);
  }
}

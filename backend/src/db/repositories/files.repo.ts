import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FileRecord } from "../../types/domain";

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Data access for public.files. Scoped by project (which is owner-checked upstream). */
export class FilesRepo {
  constructor(private readonly db: SupabaseClient) {}

  async listByProject(projectId: string): Promise<FileRecord[]> {
    const { data, error } = await this.db
      .from("files")
      .select("*")
      .eq("project_id", projectId)
      .order("path", { ascending: true });
    if (error) throw new Error(`files.listByProject failed: ${error.message}`);
    return (data ?? []) as FileRecord[];
  }

  async get(id: string): Promise<FileRecord | null> {
    const { data, error } = await this.db
      .from("files")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`files.get failed: ${error.message}`);
    return (data as FileRecord) ?? null;
  }

  async upsert(
    projectId: string,
    input: { path: string; language: string; content: string },
  ): Promise<FileRecord> {
    const contentHash = hashContent(input.content);
    const { data, error } = await this.db
      .from("files")
      .upsert(
        {
          project_id: projectId,
          path: input.path,
          language: input.language,
          content: input.content,
          content_hash: contentHash,
          size_bytes: Buffer.byteLength(input.content, "utf8"),
        },
        { onConflict: "project_id,path" },
      )
      .select()
      .single();
    if (error) throw new Error(`files.upsert failed: ${error.message}`);
    return data as FileRecord;
  }

  /**
   * Persist new content, bump the version, and clear `indexed_at` so the
   * indexing job knows the chunks are stale.
   */
  async updateContent(id: string, content: string): Promise<FileRecord | null> {
    const { data: current, error: readErr } = await this.db
      .from("files")
      .select("version")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw new Error(`files.updateContent read failed: ${readErr.message}`);
    if (!current) return null;

    const { data, error } = await this.db
      .from("files")
      .update({
        content,
        content_hash: hashContent(content),
        size_bytes: Buffer.byteLength(content, "utf8"),
        version: (current as { version: number }).version + 1,
        indexed_at: null,
      })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`files.updateContent failed: ${error.message}`);
    return (data as FileRecord) ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const { error, count } = await this.db
      .from("files")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw new Error(`files.remove failed: ${error.message}`);
    return (count ?? 0) > 0;
  }
}

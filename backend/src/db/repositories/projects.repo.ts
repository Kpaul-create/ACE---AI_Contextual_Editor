import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "../../types/domain";

/** Data access for public.projects. Every method is owner-scoped. */
export class ProjectsRepo {
  constructor(private readonly db: SupabaseClient) {}

  async listByOwner(ownerId: string): Promise<Project[]> {
    const { data, error } = await this.db
      .from("projects")
      .select("*")
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`projects.listByOwner failed: ${error.message}`);
    return (data ?? []) as Project[];
  }

  async getOwned(id: string, ownerId: string): Promise<Project | null> {
    const { data, error } = await this.db
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw new Error(`projects.getOwned failed: ${error.message}`);
    return (data as Project) ?? null;
  }

  async create(
    ownerId: string,
    input: { name: string; description?: string; language?: string; settings?: Record<string, unknown> },
  ): Promise<Project> {
    const { data, error } = await this.db
      .from("projects")
      .insert({
        owner_id: ownerId,
        name: input.name,
        description: input.description ?? null,
        language: input.language ?? "plaintext",
        settings: input.settings ?? {},
      })
      .select()
      .single();
    if (error) throw new Error(`projects.create failed: ${error.message}`);
    return data as Project;
  }

  async updateOwned(
    id: string,
    ownerId: string,
    patch: Partial<Pick<Project, "name" | "description" | "language" | "settings">>,
  ): Promise<Project | null> {
    const { data, error } = await this.db
      .from("projects")
      .update(patch)
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select()
      .maybeSingle();
    if (error) throw new Error(`projects.updateOwned failed: ${error.message}`);
    return (data as Project) ?? null;
  }

  async removeOwned(id: string, ownerId: string): Promise<boolean> {
    const { error, count } = await this.db
      .from("projects")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) throw new Error(`projects.removeOwned failed: ${error.message}`);
    return (count ?? 0) > 0;
  }
}

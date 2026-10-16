import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingStatus, Profile, WorkspacePreferences } from "../../types/domain";

/** Data access for public.profiles, written by the Clerk webhook. */
export class ProfilesRepo {
  constructor(private readonly db: SupabaseClient) {}

  async upsertFromClerk(user: {
    id: string;
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  }): Promise<Profile> {
    const { data, error } = await this.db
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          display_name: user.displayName ?? null,
          avatar_url: user.avatarUrl ?? null,
        },
        { onConflict: "id" },
      )
      .select()
      .single();
    if (error) throw new Error(`profiles.upsert failed: ${error.message}`);
    return data as Profile;
  }

  async markOnboardingComplete(
    id: string,
    preferences: WorkspacePreferences,
  ): Promise<Profile> {
    const { data, error } = await this.db
      .from("profiles")
      .update({ onboarding_status: "completed" satisfies OnboardingStatus, preferences })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`profiles.markOnboardingComplete failed: ${error.message}`);
    return data as Profile;
  }

  async get(id: string): Promise<Profile | null> {
    const { data, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`profiles.get failed: ${error.message}`);
    return (data as Profile) ?? null;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from("profiles").delete().eq("id", id);
    if (error) throw new Error(`profiles.remove failed: ${error.message}`);
  }
}

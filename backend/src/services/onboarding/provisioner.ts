import type { SupabaseClient } from "@supabase/supabase-js";
import { ProfilesRepo } from "../../db/repositories/profiles.repo";
import { ProjectsRepo } from "../../db/repositories/projects.repo";
import type { WorkspacePreferences } from "../../types/domain";

const DEFAULT_FILES: Array<{ path: string; language: string; content: string }> = [
  {
    path: "README.md",
    language: "markdown",
    content: "# Welcome to your workspace\n\nStart typing and the contextual engine will help.\n",
  },
  {
    path: "src/main.ts",
    language: "typescript",
    content: "export function main(): void {\n  // TODO: build something great\n}\n",
  },
];

/**
 * Idempotent post-onboarding provisioning.
 *
 * Runs once when the Clerk `user.updated` webhook reports onboarding complete:
 * records preferences, creates a starter project, and seeds it with a couple of
 * files. Safe to re-run — it detects an existing project and no-ops.
 */
export async function provisionWorkspace(
  db: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const profiles = new ProfilesRepo(db);
  const projects = new ProjectsRepo(db);

  const preferences = normalizePreferences(metadata);
  await profiles.markOnboardingComplete(userId, preferences);

  const existing = await projects.listByOwner(userId);
  if (existing.length > 0) return; // already provisioned

  const project = await projects.create(userId, {
    name: preferences.name ?? "My Workspace",
    language: preferences.primaryLanguage,
    settings: { theme: preferences.theme },
  });

  await db.from("files").insert(
    DEFAULT_FILES.map((f) => ({
      project_id: project.id,
      path: f.path,
      language: f.language,
      content: f.content,
      size_bytes: Buffer.byteLength(f.content, "utf8"),
    })),
  );
}

function normalizePreferences(metadata: Record<string, unknown>): WorkspacePreferences & { name?: string } {
  return {
    name: typeof metadata.workspaceName === "string" ? metadata.workspaceName : "My Workspace",
    theme: metadata.theme === "light" ? "light" : "dark",
    primaryLanguage:
      typeof metadata.primaryLanguage === "string" ? metadata.primaryLanguage : "typescript",
  };
}

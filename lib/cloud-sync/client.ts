import type { WorkspaceFile } from "@/types/workspace";

export async function syncWorkspaceFiles(
  projectId: string,
  files: WorkspaceFile[],
): Promise<void> {
  const endpoint = process.env.NEXT_PUBLIC_CLOUD_SYNC_ENDPOINT;
  if (!endpoint) {
    throw new Error("Cloud sync is not configured. Set NEXT_PUBLIC_CLOUD_SYNC_ENDPOINT.");
  }

  const baseUrl = endpoint.replace(/\/$/, "");
  const response = await fetch(
    `${baseUrl}/workspaces/${encodeURIComponent(projectId)}/files`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
    },
  );

  if (!response.ok) {
    throw new Error(`Cloud sync failed with status ${response.status}.`);
  }
}

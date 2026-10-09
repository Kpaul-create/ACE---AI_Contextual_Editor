"use client";

import { useState } from "react";
import { syncWorkspaceFiles } from "@/lib/cloud-sync/client";
import type { SyncStatus, WorkspaceFile } from "@/types/workspace";

export function useCloudSync() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function sync(projectId: string, files: WorkspaceFile[]) {
    setStatus("syncing");
    setError(null);
    try {
      await syncWorkspaceFiles(projectId, files);
      setStatus("synced");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Cloud sync failed.";
      setError(message);
      setStatus("error");
      throw new Error(message, { cause });
    }
  }

  return { status, error, sync };
}

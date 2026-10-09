"use client";

import { Cloud, CloudOff } from "lucide-react";
import { useEditorCursor } from "@/hooks/use-editor-cursor";
import type { SyncStatus } from "@/types/workspace";

export function EditorStatusBar({ status }: { status: SyncStatus }) {
  const { line, column } = useEditorCursor();
  const isSynced = status === "synced";
  const label =
    status === "syncing"
      ? "Syncing…"
      : status === "error"
        ? "Sync error"
        : isSynced
          ? "Synced"
          : "Local changes";

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-line px-3 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        {isSynced ? <Cloud size={13} /> : <CloudOff size={13} />}
        {label}
      </span>
      <span>Ln {line}, Col {column}</span>
    </footer>
  );
}

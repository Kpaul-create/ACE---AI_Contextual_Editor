"use client";

import { useState } from "react";
import { AlertCircle, Cloud, CloudOff, Files, Search } from "lucide-react";
import { ContextRail } from "@/components/editor/context-rail";
import { EditorStatusBar } from "@/components/editor/editor-status-bar";
import { FileExplorer } from "@/components/editor/file-explorer";
import { MonacoEditor } from "@/components/editor/monaco-editor";
import { WorkspaceHeader } from "@/components/editor/workspace-header";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { useFileTreeStore } from "@/stores/file-tree-store";

export function EditorShell({ projectId }: { projectId: string }) {
  const files = useFileTreeStore((state) => state.files);
  const activeFileId = useFileTreeStore((state) => state.activeFileId);
  const { status, error, sync } = useCloudSync();
  const [railVisible, setRailVisible] = useState(false);

  async function handleSync() {
    try {
      await sync(projectId, files);
    } catch {
      // The hook exposes the error in the workspace UI.
    }
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <WorkspaceHeader
        onSync={() => void handleSync()}
        isSyncing={status === "syncing"}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)_18rem]">
        <aside className="hidden min-h-0 flex-col border-r border-line bg-panel md:flex">
          <div className="flex h-12 items-center justify-between px-4">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Explorer
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" className="size-7 p-0" aria-label="Search files">
                <Search size={14} />
              </Button>
              <Button variant="ghost" className="size-7 p-0" aria-label="Files">
                <Files size={14} />
              </Button>
            </div>
          </div>
          <div className="px-2">
            <FileExplorer />
          </div>
          <div className="mt-auto border-t border-line px-4 py-3 text-[11px] text-muted">
            <div className="mb-2 font-medium text-foreground">Workspace status</div>
            <div className="flex items-center gap-2">
              {status === "synced" ? <Cloud size={13} /> : <CloudOff size={13} />}
              {status === "syncing"
                ? "Syncing files"
                : status === "synced"
                  ? "All changes synced"
                  : status === "error"
                    ? "Sync needs attention"
                    : "Local changes"}
            </div>
          </div>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-4">
            <span className="text-xs text-muted">
              {files.find((file) => file.id === activeFileId)?.path}
            </span>
            <button
              type="button"
              onClick={() => setRailVisible((visible) => !visible)}
              className="text-[11px] text-muted hover:text-foreground"
            >
              {railVisible ? "Hide context" : "Show context"}
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <MonacoEditor />
          </div>
          <EditorStatusBar status={status} />
          {status === "syncing" && (
            <div className="border-t border-line px-4 py-2">
              <Loader label="Syncing workspace files" />
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-center gap-2 border-t border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-300">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </section>
        <div className="hidden min-h-0 md:block">
          <ContextRail />
        </div>
      </div>
      {railVisible && (
        <div className="fixed inset-x-0 bottom-8 top-14 z-20 border-t border-line bg-canvas md:hidden">
          <ContextRail />
        </div>
      )}
    </main>
  );
}

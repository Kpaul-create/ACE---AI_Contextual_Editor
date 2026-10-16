"use client";

import { useState } from "react";
import { AlertCircle, Files, Search, SplitSquareHorizontal, X } from "lucide-react";
import { Tile } from "@/components/shared/tile";
import { BrowserPane } from "@/components/editor/browser-pane";
import { EditorStatusBar } from "@/components/editor/editor-status-bar";
import { FileExplorer } from "@/components/editor/file-explorer";
import { MonacoEditor } from "@/components/editor/monaco-editor";
import { CompileStatus } from "@/components/editor/compile-status";
import { TerminalPane } from "@/components/editor/terminal-pane";
import { AgentPanel } from "@/components/agent/agent-panel";
import { CollabPresence } from "@/components/shared/collab-presence";
import { Loader } from "@/components/ui/loader";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { useFileTreeStore } from "@/stores/file-tree-store";
import { flags } from "@/src/flags";
import { cn } from "@/lib/utils";

/* ── Tab bar ─────────────────────────────────────────────────────────────── */
function TabBar({
  onSync,
  isSyncing,
  splitFileId,
  onSplitClose,
}: {
  onSync: () => void;
  isSyncing: boolean;
  splitFileId?: string;
  onSplitClose?: () => void;
}) {
  const files         = useFileTreeStore((s) => s.files);
  const activeFileId  = useFileTreeStore((s) => s.activeFileId);
  const setActiveFile = useFileTreeStore((s) => s.setActiveFile);

  // Show only the active file + up to 4 recent others
  const shown = files.slice(0, 6);

  return (
    <div className="flex h-8 shrink-0 items-center border-b border-[var(--surface-border)] bg-black/10">
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
        {shown.map((f) => {
          const isActive = f.id === activeFileId;
          const isSplit  = f.id === splitFileId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFile(f.id)}
              className={cn(
                "group flex h-full shrink-0 items-center gap-1.5 border-r border-[var(--surface-border)] px-3 font-mono text-[11px] transition-colors",
                isActive
                  ? "bg-white/[0.08] text-white/85"
                  : "text-white/30 hover:text-white/60",
              )}
            >
              <span className="max-w-[100px] truncate">{f.name}</span>
              {isActive && <span className="size-1.5 rounded-full bg-accent/70" />}
              {isSplit && onSplitClose && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onSplitClose(); }}
                  onKeyDown={(e) => e.key === "Enter" && onSplitClose()}
                  className="ml-0.5 rounded p-px opacity-0 group-hover:opacity-100 hover:text-red-400"
                >
                  <X size={9} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {flags.compilePipeline && <CompileStatus />}
      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing}
        className="shrink-0 px-3 font-mono text-[10px] text-white/25 hover:text-white/60 disabled:opacity-40"
      >
        {isSyncing ? "syncing…" : "↑ sync"}
      </button>
    </div>
  );
}

/* ── Split editor pane ───────────────────────────────────────────────────── */
function SplitPane({ fileId }: { fileId: string }) {
  const files = useFileTreeStore((s) => s.files);
  const file = files.find((f) => f.id === fileId);
  if (!file) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 shrink-0 items-center border-b border-[var(--surface-border)] bg-black/10 px-3">
        <span className="font-mono text-[10px] text-white/40">{file.name}</span>
      </div>
      <div className="min-h-0 flex-1">
        <MonacoEditor overrideFileId={fileId} />
      </div>
    </div>
  );
}

/* ── Main shell ──────────────────────────────────────────────────────────── */
export function EditorShell({ projectId }: { projectId: string }) {
  const files = useFileTreeStore((s) => s.files);
  const { status, error, sync } = useCloudSync();

  const [showBrowser, setShowBrowser] = useState(false);
  const [splitFileId, setSplitFileId] = useState<string | null>(null);
  const [rightTab, setRightTab]       = useState<"agent" | "context">("agent");

  const tokens = Math.ceil(
    files.reduce((t, f) => t + f.content.length, 0) / 4,
  );

  async function handleSync() {
    try { await sync(projectId, files); } catch { /* surfaced via error state */ }
  }

  function openSplit() {
    const second = files.find((f) => f.id !== files[0]?.id);
    if (second) setSplitFileId(second.id);
  }

  return (
    <div className="flex h-dvh flex-col gap-1.5 overflow-hidden p-1.5">

      {/* ── Tiling grid ──────────────────────────────────────────────── */}
      <div
        className="grid min-h-0 flex-1 gap-1.5"
        style={{
          gridTemplateColumns: "13rem 1fr 15rem",
          gridTemplateRows: [
            "1fr",
            showBrowser ? "200px" : "",
            flags.browserRuntime ? "140px" : "",
          ].filter(Boolean).join(" "),
        }}
      >
        {/* ── Explorer ─────────────────────────────────────────────── */}
        <Tile
          title="explorer"
          actions={
            <div className="flex gap-0.5">
              <button type="button" className="rounded p-1 text-white/25 hover:text-white/70" aria-label="Search">
                <Search size={11} />
              </button>
              <button type="button" className="rounded p-1 text-white/25 hover:text-white/70" aria-label="Files">
                <Files size={11} />
              </button>
            </div>
          }
          className={cn(showBrowser ? "row-span-2" : "")}
          contentClassName="overflow-y-auto py-1"
        >
          <FileExplorer />
        </Tile>

        {/* ── Editor area (single or split) ────────────────────────── */}
        <Tile noTitleBar eager className="flex flex-col">
          <TabBar
            onSync={() => void handleSync()}
            isSyncing={status === "syncing"}
            splitFileId={splitFileId ?? undefined}
            onSplitClose={() => setSplitFileId(null)}
          />

          {/* editor body — single or split */}
          <div className="flex min-h-0 flex-1">
            {/* primary pane */}
            <div className={cn("flex min-h-0 flex-col", splitFileId ? "w-1/2 border-r border-[var(--surface-border)]" : "flex-1")}>
              <div className="min-h-0 flex-1">
                <MonacoEditor />
              </div>
            </div>

            {/* split pane */}
            {splitFileId && (
              <div className="flex min-h-0 w-1/2 flex-col">
                <SplitPane fileId={splitFileId} />
              </div>
            )}
          </div>

          {/* split toggle button */}
          <div className="flex shrink-0 items-center justify-end border-t border-[var(--surface-border)] bg-black/10 px-2 py-0.5">
            <button
              type="button"
              onClick={splitFileId ? () => setSplitFileId(null) : openSplit}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[9px] transition-colors",
                splitFileId ? "text-accent/70 hover:text-accent" : "text-white/20 hover:text-white/50",
              )}
            >
              <SplitSquareHorizontal size={10} />
              {splitFileId ? "close split" : "split"}
            </button>
          </div>

          {status === "syncing" && (
            <div className="shrink-0 border-t border-[var(--surface-border)] px-3 py-1.5">
              <Loader label="Syncing workspace files" />
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="flex shrink-0 items-center gap-2 border-t border-red-500/20 bg-red-500/5 px-3 py-1.5 font-mono text-[10px] text-red-300"
            >
              <AlertCircle size={11} />
              {error}
            </div>
          )}
        </Tile>

        {/* ── Right rail: Agent + Context tabs ─────────────────────── */}
        <Tile
          noTitleBar
          className="flex flex-col"
        >
          {/* tab switcher */}
          <div className="flex h-8 shrink-0 items-center border-b border-[var(--surface-border)] bg-black/10">
            {(["agent", "context"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightTab(tab)}
                className={cn(
                  "flex h-full items-center border-r border-[var(--surface-border)] px-3 font-mono text-[10px] transition-colors",
                  rightTab === tab
                    ? "bg-white/[0.07] text-white/80"
                    : "text-white/30 hover:text-white/60",
                )}
              >
                {tab}
              </button>
            ))}
            {/* browser toggle */}
            <button
              type="button"
              onClick={() => setShowBrowser((v) => !v)}
              className={cn(
                "ml-auto px-2 font-mono text-[9px] transition-colors",
                showBrowser ? "text-accent/70" : "text-white/20 hover:text-white/50",
              )}
            >
              browser
            </button>
          </div>

          {/* tab content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {rightTab === "agent" ? (
              <AgentPanel />
            ) : (
              <div className="flex h-full flex-col overflow-y-auto p-3">
                <section className="space-y-2">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">
                    Workspace context
                  </p>
                  <div className="rounded border border-dashed border-[var(--surface-border)] p-2.5 font-mono text-[10px] leading-5 text-white/25">
                    Context sources will appear here as they are connected to the project.
                  </div>
                </section>
                <section className="mt-4 space-y-2">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">
                    Token usage
                  </p>
                  <div className="rounded border border-[var(--surface-border)] bg-black/20 p-2.5">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-white/35">Estimate</span>
                      <span className="text-white/60">{tokens.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min((tokens / 32000) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 font-mono text-[9px] text-white/20">· 32k context</p>
                  </div>
                </section>
              </div>
            )}
          </div>
        </Tile>

        {/* ── Browser Pane — row 2, col 2 ──────────────────────────── */}
        {showBrowser && (
          <div className="col-start-2 col-end-3 min-h-0" style={{ gridRow: 2 }}>
            <BrowserPane />
          </div>
        )}

        {/* ── Terminal Pane — last row, col 2 ──────────────────────── */}
        {flags.browserRuntime && (
          <div
            className="col-start-2 col-end-3 min-h-0"
            style={{ gridRow: showBrowser ? 3 : 2 }}
          >
            <Tile noTitleBar eager>
              <TerminalPane />
            </Tile>
          </div>
        )}
      </div>

      {/* ── StatusBar ────────────────────────────────────────────────── */}
      <div className="glass-surface shrink-0 overflow-hidden">
        <div className="flex items-center">
          <div className="flex-1">
            <EditorStatusBar status={status} />
          </div>
          {flags.p2pCollab && (
            <div className="shrink-0 border-l border-[var(--surface-border)] px-3">
              <CollabPresence projectId={projectId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { Braces, CircleHelp, Sparkles } from "lucide-react";
import { useFileTreeStore } from "@/stores/file-tree-store";

export function ContextRail() {
  const files = useFileTreeStore((state) => state.files);
  const tokens = Math.ceil(
    files.reduce((total, file) => total + file.content.length, 0) / 4,
  );

  return (
    <aside className="flex h-full flex-col border-l border-line bg-panel">
      <div className="flex h-12 items-center gap-2 border-b border-line px-4 text-xs font-medium">
        <Sparkles size={14} className="text-accent" />
        Context
      </div>
      <div className="flex-1 space-y-6 p-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted">
            <span>Workspace context</span>
            <CircleHelp size={13} />
          </div>
          <div className="rounded-lg border border-dashed border-line p-3 text-xs leading-5 text-muted">
            Context sources will appear here as they are connected to the project.
          </div>
        </section>
        <section className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Usage
          </div>
          <div className="rounded-lg border border-line bg-black/10 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted">
                <Braces size={14} />
                Workspace estimate
              </span>
              <span>{tokens.toLocaleString()}</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min((tokens / 32000) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-muted">Estimated tokens · 32k context</p>
          </div>
        </section>
      </div>
      <div className="border-t border-line p-4 text-[11px] text-muted">
        Your context stays scoped to this workspace.
      </div>
    </aside>
  );
}

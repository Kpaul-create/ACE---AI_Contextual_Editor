"use client";

import Link from "next/link";
import { ArrowUpRight, Command, PanelRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function WorkspaceHeader({
  onSync,
  isSyncing,
}: {
  onSync: () => void;
  isSyncing: boolean;
}) {
  const workspaceName = useWorkspaceStore((state) => state.preferences.name);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" aria-label="ACE home" className="text-accent">
          <Sparkles size={18} />
        </Link>
        <span className="hidden text-line sm:block">/</span>
        <span className="truncate text-sm font-medium">{workspaceName}</span>
        <span className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">
          PERSONAL
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[11px] text-muted md:flex">
          <Command size={12} />
          <span>⌘ K</span>
        </div>
        <Button
          onClick={onSync}
          disabled={isSyncing}
          className="px-2.5 py-1.5 text-xs"
        >
          <ArrowUpRight size={14} />
          <span className="hidden sm:inline">{isSyncing ? "Syncing" : "Sync files"}</span>
        </Button>
        <PanelRight size={16} className="ml-1 hidden text-muted md:block" />
      </div>
    </header>
  );
}

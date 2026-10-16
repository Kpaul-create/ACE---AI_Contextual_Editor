"use client";

import { Cloud, CloudOff, Circle } from "lucide-react";
import { useCursorLineColumn } from "@/hooks/use-editor-cursor";
import {
  useSessionStore,
  selectProvider,
  type Provider,
} from "@/stores/session-store";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/types/workspace";

const PROVIDERS: Provider[] = ["grok", "venice", "opencode"];

const PROVIDER_LABELS: Record<Provider, string> = {
  grok:     "Grok",
  venice:   "Venice",
  opencode: "OpenCode",
};

export function EditorStatusBar({ status }: { status: SyncStatus }) {
  const { line, column } = useCursorLineColumn();
  const provider    = useSessionStore(selectProvider);
  const session     = useSessionStore((s) => s[provider]);
  const setProvider = useSessionStore((s) => s.setProvider);

  const isSynced = status === "synced";
  const syncLabel =
    status === "syncing" ? "Syncing…"
    : status === "error"  ? "Sync error"
    : isSynced            ? "Synced"
    : "Local";

  const authColor =
    session.authState === "authenticated" ? "text-green-400"
    : session.authState === "expired"     ? "text-red-400"
    : "text-white/25";

  return (
    <div className="flex h-6 items-center justify-between px-3 font-mono text-[10px] text-white/35 select-none">
      {/* ── Left ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* ACE badge */}
        <span className="rounded bg-accent/20 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-accent">
          ACE
        </span>

        {/* provider switcher */}
        <div className="flex items-center gap-px">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={cn(
                "rounded px-1.5 py-px font-mono text-[10px] transition-colors",
                p === provider
                  ? "bg-white/10 text-white/75"
                  : "text-white/25 hover:text-white/55",
              )}
            >
              {PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>

        {/* auth state */}
        <span className={cn("flex items-center gap-1", authColor)}>
          <Circle size={5} className="fill-current" />
          {session.authState}
        </span>

        {/* sync */}
        <span className="flex items-center gap-1">
          {isSynced ? <Cloud size={10} /> : <CloudOff size={10} />}
          {syncLabel}
        </span>
      </div>

      {/* ── Right ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span>Ln {line}, Col {column}</span>
        <span>UTF-8</span>
        <span className="flex items-center gap-1 text-green-400/70">
          <Circle size={5} className="fill-current" />
          Live
        </span>
      </div>
    </div>
  );
}

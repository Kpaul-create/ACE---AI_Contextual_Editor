"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { GlassWindow } from "@/components/shared/glass-window";
import {
  useSessionStore,
  selectProvider,
  type Provider,
} from "@/stores/session-store";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<Provider, string> = {
  grok:     "Grok",
  venice:   "Venice",
  opencode: "OpenCode",
};

const PROVIDER_URLS: Record<Provider, string> = {
  grok:     "https://grok.x.com",
  venice:   "https://venice.ai",
  opencode: "http://localhost:3001",
};

export function BrowserPane() {
  const provider      = useSessionStore(selectProvider);
  const session       = useSessionStore((s) => s[provider]);
  const setContextId  = useSessionStore((s) => s.setContextId);
  const setAuthState  = useSessionStore((s) => s.setAuthState);
  const expireSession = useSessionStore((s) => s.expireSession);

  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // Use a ref for the poll interval so it doesn't cause re-renders
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const contextIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((contextId: string) => {
    stopPolling();
    contextIdRef.current = contextId;
    pollRef.current = setInterval(async () => {
      const cid = contextIdRef.current;
      if (!cid) return;
      try {
        const res = await fetch("/api/v1/browser/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contextId: cid }),
        });
        if (res.status === 204) return; // throttled frame — skip
        if (!res.ok) return;
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        setScreenshotSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        /* non-fatal — next tick retries */
      }
    }, 500);
  }, [stopPolling]);

  const initSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    stopPolling();
    contextIdRef.current = null;

    try {
      const res = await fetch("/api/v1/browser/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Browser service returned ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`);
      }

      const data = (await res.json()) as { contextId: string; authState: string };
      setContextId(provider, data.contextId);
      setAuthState(provider, data.authState as "guest" | "authenticated" | "expired");
      startPolling(data.contextId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start browser session";
      setError(msg);
      expireSession(provider);
    } finally {
      setLoading(false);
    }
  }, [provider, setContextId, setAuthState, expireSession, startPolling, stopPolling]);

  // Re-init only when provider changes
  useEffect(() => {
    void initSession();
    return () => {
      stopPolling();
      contextIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLImageElement>) => {
      const cid = contextIdRef.current;
      if (!cid) return;
      const rect = (e.target as HTMLImageElement).getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width)  * 1280;
      const y = ((e.clientY - rect.top)  / rect.height) * 800;
      await fetch("/api/v1/browser/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId: cid, type: "click", x, y }),
      }).catch(() => null);
    },
    [],
  );

  const titleActions = (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "rounded px-1.5 py-px font-mono text-[9px] uppercase tracking-wider",
          session.authState === "authenticated"
            ? "bg-green-500/20 text-green-400"
            : session.authState === "expired"
              ? "bg-red-500/20 text-red-400"
              : "bg-white/8 text-white/35",
        )}
      >
        {session.authState}
      </span>
      <button
        type="button"
        onClick={() => void initSession()}
        className="rounded p-0.5 text-white/30 hover:text-white/70"
        aria-label="Reload browser session"
      >
        <RefreshCw size={10} />
      </button>
    </div>
  );

  return (
    <GlassWindow
      title={`browser — ${PROVIDER_LABELS[provider]}`}
      actions={titleActions}
      className="h-full"
    >
      <div className="flex h-full flex-col">
        {/* address bar */}
        <div className="flex h-6 shrink-0 items-center gap-2 border-b border-[var(--surface-border)] bg-black/10 px-3">
          <Globe size={10} className="shrink-0 text-white/25" />
          <span className="truncate font-mono text-[10px] text-white/35">
            {PROVIDER_URLS[provider]}
          </span>
        </div>

        {/* viewport */}
        <div className="relative min-h-0 flex-1 bg-black/20">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-white/30" />
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <ShieldAlert size={16} className="text-red-400/60" />
              <p className="max-w-xs font-mono text-[10px] leading-5 text-red-300/60">{error}</p>
              <p className="font-mono text-[9px] text-white/20">
                Start the backend server to enable the browser pane.
              </p>
              <button
                type="button"
                onClick={() => void initSession()}
                className="mt-1 rounded border border-white/10 px-3 py-1 font-mono text-[10px] text-white/40 hover:text-white/70"
              >
                retry
              </button>
            </div>
          )}

          {screenshotSrc && !error && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshotSrc}
              alt="Browser viewport"
              className="h-full w-full cursor-crosshair object-contain"
              onClick={handleCanvasClick}
              draggable={false}
            />
          )}

          {!screenshotSrc && !loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[10px] text-white/15">
                waiting for session…
              </span>
            </div>
          )}
        </div>
      </div>
    </GlassWindow>
  );
}

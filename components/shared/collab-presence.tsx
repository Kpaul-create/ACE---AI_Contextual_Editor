"use client";

import { useEffect, useRef, useState } from "react";
import { getCollab } from "@/src/adapters";
import type { CollabPeer } from "@/src/adapters";
import { useSessionStore, selectProvider } from "@/stores/session-store";

/** Deterministic hue from a string id */
function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % 360;
}

function PeerDot({ peer }: { peer: CollabPeer }) {
  const label = peer.name ?? peer.id.slice(0, 2).toUpperCase();
  const hue   = hueOf(peer.id);
  return (
    <span
      title={peer.name ?? peer.id}
      className="flex size-4 items-center justify-center rounded-full font-mono text-[8px] font-bold text-black/70"
      style={{ background: `hsl(${hue} 70% 65%)` }}
    >
      {label.slice(0, 2)}
    </span>
  );
}

/**
 * Connects to a collab room derived from the current provider and shows
 * live peer avatars. Only mounted when flags.p2pCollab is true.
 */
export function CollabPresence({ projectId }: { projectId: string }) {
  const provider  = useSessionStore(selectProvider);
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const [connected, setConnected] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const collab  = getCollab();
    const roomId  = `ace-${projectId}-${provider}`;
    const userId  = `user-${Math.random().toString(36).slice(2, 8)}`;

    unsubRef.current = collab.onPeersChange((p) => setPeers(p));

    collab.connect(roomId, userId)
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => {
      unsubRef.current?.();
      void collab.disconnect();
      setConnected(false);
      setPeers([]);
    };
  }, [projectId, provider]);

  return (
    <span className="flex items-center gap-1.5">
      {/* connection dot */}
      <span
        className="size-1.5 rounded-full"
        style={{ background: connected ? "hsl(142 70% 55%)" : "hsl(0 0% 35%)" }}
        title={connected ? "collab connected" : "collab connecting…"}
      />
      {peers.length === 0 ? (
        <span className="font-mono text-[9px] text-white/20">solo</span>
      ) : (
        <span className="flex items-center gap-0.5">
          {peers.slice(0, 5).map((p) => <PeerDot key={p.id} peer={p} />)}
          {peers.length > 5 && (
            <span className="font-mono text-[9px] text-white/30">+{peers.length - 5}</span>
          )}
        </span>
      )}
    </span>
  );
}

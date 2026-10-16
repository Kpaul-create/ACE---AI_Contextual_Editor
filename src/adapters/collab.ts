/**
 * CollabTransport adapter.
 *
 * Abstracts the real-time collaboration channel.
 * Call sites depend ONLY on this interface.
 *
 * Implementations:
 *   WebRtcTransport — Phase 7: y-webrtc P2P, no server required
 */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

/* ── Interface ───────────────────────────────────────────────────────────── */

export interface CollabPeer {
  id: string;
  name?: string;
}

export interface CollabTransport {
  /** Connect to a room identified by roomId. */
  connect(roomId: string, userId: string): Promise<void>;

  /** Disconnect and release resources. */
  disconnect(): Promise<void>;

  /** Current connected peers (excluding self). */
  peers(): CollabPeer[];

  /** Subscribe to peer list changes. Returns unsubscribe fn. */
  onPeersChange(cb: (peers: CollabPeer[]) => void): () => void;

  /**
   * The underlying Yjs document — consumers can bind Monaco or other
   * CRDT-aware editors directly to this doc.
   */
  readonly doc: Y.Doc;
}

/* ── WebRtcTransport ─────────────────────────────────────────────────────── */

export class WebRtcTransport implements CollabTransport {
  readonly doc: Y.Doc;
  private provider: WebrtcProvider | null = null;
  private _peers: CollabPeer[] = [];
  private listeners: Array<(peers: CollabPeer[]) => void> = [];

  constructor() {
    this.doc = new Y.Doc();
  }

  async connect(roomId: string, userId: string): Promise<void> {
    if (this.provider) return; // already connected

    this.provider = new WebrtcProvider(roomId, this.doc, {
      // Public signalling servers — no infrastructure needed.
      // In production, swap for a self-hosted signalling server.
      signaling: [
        "wss://signaling.yjs.dev",
        "wss://y-webrtc-signaling-eu.herokuapp.com",
        "wss://y-webrtc-signaling-us.herokuapp.com",
      ],
    });

    // Announce our own awareness state
    this.provider.awareness.setLocalStateField("user", {
      id: userId,
      name: userId,
    });

    this.provider.awareness.on("change", () => {
      this._peers = this._buildPeers(userId);
      this.listeners.forEach((cb) => cb(this._peers));
    });
  }

  async disconnect(): Promise<void> {
    this.provider?.destroy();
    this.provider = null;
    this._peers = [];
    this.listeners.forEach((cb) => cb([]));
  }

  peers(): CollabPeer[] {
    return this._peers;
  }

  onPeersChange(cb: (peers: CollabPeer[]) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private _buildPeers(selfId: string): CollabPeer[] {
    if (!this.provider) return [];
    const states = this.provider.awareness.getStates();
    const peers: CollabPeer[] = [];
    states.forEach((state) => {
      const user = state["user"] as { id?: string; name?: string } | undefined;
      if (!user?.id || user.id === selfId) return;
      peers.push({ id: user.id, name: user.name });
    });
    return peers;
  }
}

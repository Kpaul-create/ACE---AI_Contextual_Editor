import { create } from "zustand";

export type Provider = "grok" | "venice" | "opencode";
export type AuthState = "guest" | "authenticated" | "expired";

interface ProviderSession {
  authState: AuthState;
  /** Last known URL inside the embedded browser for this provider */
  url: string | null;
  /** Opaque session token / context ID returned by the browser service */
  contextId: string | null;
}

interface SessionState {
  provider: Provider;
  grok: ProviderSession;
  venice: ProviderSession;
  opencode: ProviderSession;

  setProvider: (provider: Provider) => void;
  setAuthState: (provider: Provider, authState: AuthState) => void;
  setContextId: (provider: Provider, contextId: string | null) => void;
  setUrl: (provider: Provider, url: string | null) => void;
  /** Degrade to guest without crashing — called on session expiry */
  expireSession: (provider: Provider) => void;
}

const defaultSession = (): ProviderSession => ({
  authState: "guest",
  url: null,
  contextId: null,
});

function patchProvider(
  state: SessionState,
  provider: Provider,
  patch: Partial<ProviderSession>,
): Partial<SessionState> {
  return { [provider]: { ...state[provider], ...patch } };
}

export const useSessionStore = create<SessionState>((set, get) => ({
  provider: "grok",
  grok: defaultSession(),
  venice: defaultSession(),
  opencode: defaultSession(),

  setProvider: (provider) => set({ provider }),

  setAuthState: (provider, authState) =>
    set((s) => patchProvider(s, provider, { authState })),

  setContextId: (provider, contextId) =>
    set((s) => patchProvider(s, provider, { contextId })),

  setUrl: (provider, url) =>
    set((s) => patchProvider(s, provider, { url })),

  expireSession: (provider) =>
    set((s) =>
      patchProvider(s, provider, {
        authState: "expired",
        contextId: null,
      }),
    ),
}));

/* ── Atomic selectors (never return new objects from bare selectors) ──────── */

export const selectProvider = (s: SessionState) => s.provider;
export const selectActiveSession = (s: SessionState) => s[s.provider];
export const selectGrokSession = (s: SessionState) => s.grok;
export const selectVeniceSession = (s: SessionState) => s.venice;
export const selectOpenCodeSession = (s: SessionState) => s.opencode;

/**
 * AuthProvider adapter.
 *
 * Abstracts session and token management.
 * Call sites depend ONLY on this interface.
 *
 * Implementations:
 *   ClientAuth  — current: Clerk client-side SDK (@clerk/nextjs)
 *   ServerAuth  — (not built) Worker JWT verify endpoint
 *
 * NOTE: ClientAuth is a thin wrapper. It does NOT import Clerk directly here
 * to avoid pulling the SDK into non-React contexts. The concrete Clerk calls
 * stay in components/providers/app-providers.tsx and middleware.ts.
 * This interface is for call sites that need to ask "am I authed?" without
 * coupling to Clerk's API shape.
 */

/* ── Interface ───────────────────────────────────────────────────────────── */

export interface Session {
  userId: string;
  email?: string | null;
}

export interface AuthProvider {
  /** Returns the current session, or null if unauthenticated. */
  getSession(): Promise<Session | null>;

  /**
   * Returns a short-lived JWT for authenticating requests.
   * Returns null if unauthenticated.
   */
  getToken(): Promise<string | null>;

  /**
   * Verify a JWT string. Returns the session it encodes, or null if invalid.
   * In ClientAuth this is a no-op (verification happens server-side).
   */
  verify(token: string): Promise<Session | null>;
}

/* ── ClientAuth — wraps Clerk's client-side state ────────────────────────── */

/**
 * ClientAuth reads from window.__clerk if available (set by ClerkProvider).
 * It never makes a network call — Clerk's SDK handles token refresh internally.
 *
 * This is intentionally minimal. The full Clerk SDK surface is still used
 * directly in React components via @clerk/nextjs hooks.
 */
export class ClientAuth implements AuthProvider {
  async getSession(): Promise<Session | null> {
    // Access Clerk's global if available (set after ClerkProvider mounts).
    const clerk = (
      typeof window !== "undefined"
        ? (window as unknown as { Clerk?: { user?: { id: string; primaryEmailAddress?: { emailAddress: string } } } }).Clerk
        : undefined
    );
    if (!clerk?.user) return null;
    return {
      userId: clerk.user.id,
      email: clerk.user.primaryEmailAddress?.emailAddress ?? null,
    };
  }

  async getToken(): Promise<string | null> {
    const clerk = (
      typeof window !== "undefined"
        ? (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } } }).Clerk
        : undefined
    );
    if (!clerk?.session) return null;
    return clerk.session.getToken();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verify(_token: string): Promise<Session | null> {
    // Client-side: verification is handled by Clerk's middleware.
    // This is a no-op — return null to signal "not verified client-side".
    return null;
  }
}

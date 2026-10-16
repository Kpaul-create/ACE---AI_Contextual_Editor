import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

/**
 * Server-only Supabase client using the service-role key. RLS is bypassed by
 * design here; tenant isolation is enforced in the application layer (every
 * repository method is owner/project scoped) so a missing filter is a bug we can
 * see, not a silent data leak.
 *
 * The JWT persistence/refresh machinery is disabled — this is a backend
 * process, not a browser session.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "ace-backend" } },
  });
}

let singleton: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!singleton) singleton = createServiceClient();
  return singleton;
}

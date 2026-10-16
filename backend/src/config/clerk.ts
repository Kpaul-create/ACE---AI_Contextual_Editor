import { Webhook } from "svix";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { ProfilesRepo } from "../db/repositories/profiles.repo";
import { provisionWorkspace } from "../services/onboarding/provisioner";

/**
 * Clerk webhook verification + payload processing.
 *
 * Clerk signs webhooks with Svix. We verify against the *raw* request body
 * (never a re-serialized JSON object) using the signing secret, then dispatch to
 * typed processors. This is the single place a Clerk user becomes a local
 * profile row — application code never trusts a user id it hasn't seen here.
 */

export interface ClerkWebhookHeaders {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
}

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

export interface ClerkUserPayload {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  public_metadata?: Record<string, unknown>;
  unsafe_metadata?: Record<string, unknown>;
}

export interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserPayload;
}

/** Throws if the signature is invalid or the payload is malformed. */
export function verifyWebhook(
  rawBody: Buffer | string,
  headers: ClerkWebhookHeaders,
): ClerkWebhookEvent {
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  try {
    return wh.verify(rawBody, {
      "svix-id": headers["svix-id"],
      "svix-timestamp": headers["svix-timestamp"],
      "svix-signature": headers["svix-signature"],
    }) as ClerkWebhookEvent;
  } catch (err) {
    throw new Error(
      `Invalid Clerk webhook signature: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function primaryEmail(user: ClerkUserPayload): string | null {
  const primaryId = user.primary_email_address_id;
  const match = user.email_addresses?.find((e) => e.id === primaryId);
  return (match ?? user.email_addresses?.[0])?.email_address ?? null;
}

function displayName(user: ClerkUserPayload): string | null {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}

/**
 * Handle a verified Clerk event. Returns a short label describing what ran, for
 * logging/telemetry. Unknown event types are ignored without error.
 */
export async function processWebhookEvent(
  db: SupabaseClient,
  event: ClerkWebhookEvent,
): Promise<string> {
  const profiles = new ProfilesRepo(db);
  const user = event.data;

  switch (event.type) {
    case "user.created": {
      await profiles.upsertFromClerk({
        id: user.id,
        email: primaryEmail(user),
        displayName: displayName(user),
        avatarUrl: user.image_url ?? null,
      });
      return "user.created:profile-created";
    }

    case "user.updated": {
      await profiles.upsertFromClerk({
        id: user.id,
        email: primaryEmail(user),
        displayName: displayName(user),
        avatarUrl: user.image_url ?? null,
      });

      // Onboarding completion is signalled via Clerk public metadata, which the
      // Next.js onboarding wizard sets before this webhook fires.
      const completed = user.public_metadata?.onboardingCompleted === true;
      if (completed) {
        await provisionWorkspace(db, user.id, user.public_metadata ?? {});
        return "user.updated:profile-synced+workspace-provisioned";
      }
      return "user.updated:profile-synced";
    }

    case "user.deleted": {
      if (user.id) await profiles.remove(user.id);
      return "user.deleted:profile-removed";
    }

    case "session.created":
    case "session.removed":
      // Sessions are validated on every request via the Clerk JWT; nothing to
      // persist. Hook here if you need an audit trail.
      return `${event.type}:noop`;

    default:
      return `${event.type}:ignored`;
  }
}

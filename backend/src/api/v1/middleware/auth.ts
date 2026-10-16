import { getAuth } from "@clerk/fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Auth middleware. Clerk's Fastify plugin attaches a verified session to the
 * request; we expose a tiny helper plus a preHandler that rejects anonymous
 * calls with a consistent error envelope.
 */

export function getUserId(req: FastifyRequest): string | null {
  const { userId } = getAuth(req);
  return userId ?? null;
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!getUserId(req)) {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Authentication required" },
    });
  }
}

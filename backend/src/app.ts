import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { clerkPlugin } from "@clerk/fastify";
import { env, corsOrigins, isProduction } from "./config/env";
import { verifyWebhook, processWebhookEvent } from "./config/clerk";
import { getDb } from "./db/client";
import { v1Routes } from "./api/v1";
import { registerErrorHandler } from "./api/v1/middleware/errors";

/**
 * Compose the Fastify application without binding a port, so tests can inject
 * requests against the same instance.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: isProduction ? undefined : { target: "pino-pretty" },
    },
    trustProxy: true,
  });

  app.register(cors, { origin: corsOrigins, credentials: true });
  app.register(clerkPlugin);

  // Preserve the raw body for Svix webhook verification while still parsing JSON.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      (req as { rawBody?: Buffer }).rawBody = body as Buffer;
      try {
        done(null, JSON.parse((body as Buffer).toString("utf8")));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  registerErrorHandler(app);

  app.get("/health", async () => ({ status: "ok", model: env.COMPLETION_MODEL }));

  /**
   * Clerk webhook → profile sync + workspace provisioning.
   * Note: unauthenticated by design; authenticity comes from the Svix signature.
   */
  app.post("/webhooks/clerk", async (req, reply) => {
    const rawBody = (req as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      reply.code(400).send({ error: { code: "bad_request", message: "Missing raw body" } });
      return;
    }

    let label: string;
    try {
      const event = verifyWebhook(rawBody, {
        "svix-id": String(req.headers["svix-id"] ?? ""),
        "svix-timestamp": String(req.headers["svix-timestamp"] ?? ""),
        "svix-signature": String(req.headers["svix-signature"] ?? ""),
      });
      label = await processWebhookEvent(getDb(), event);
    } catch (err) {
      req.log.warn({ err }, "Rejected Clerk webhook");
      reply.code(400).send({ error: { code: "invalid_webhook", message: "Verification failed" } });
      return;
    }

    reply.code(200).send({ received: true, handled: label });
  });

  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}

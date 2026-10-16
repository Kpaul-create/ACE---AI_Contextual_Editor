import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getBrowserManager, type Provider } from "../../../services/browser/manager.js";
import { getUserId } from "../middleware/auth.js";
import { AppError } from "../middleware/errors.js";
import { parse } from "../middleware/validate.js";

const SessionBodySchema = z.object({
  provider: z.enum(["grok", "venice", "opencode"]),
});

const ActionBodySchema = z.object({
  contextId: z.string().min(1),
  type: z.enum(["click", "type", "navigate", "key"]),
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  key: z.string().optional(),
});

const ScreenshotBodySchema = z.object({
  contextId: z.string().min(1),
});

export const browserRoutes: FastifyPluginAsync = async (app) => {
  const manager = getBrowserManager();

  /**
   * POST /api/v1/browser/session
   * Create or resume a browser context for the given provider.
   * Works for both authed and guest users (userId falls back to "guest").
   */
  app.post("/browser/session", async (req, reply) => {
    const body = parse(SessionBodySchema, req.body);
    // Use Clerk userId when available; fall back to a stable guest id per IP.
    const userId = getUserId(req) ?? `guest::${req.ip}`;

    let handle;
    try {
      handle = await manager.getOrCreateContext(userId, body.provider as Provider);
    } catch (err) {
      req.log.error({ err }, "Failed to create browser context");
      throw new AppError(503, "browser_unavailable", "Browser service unavailable");
    }

    return reply.send({
      contextId: handle.contextId,
      authState: handle.authState,
      provider: handle.provider,
    });
  });

  /**
   * POST /api/v1/browser/screenshot
   * Returns a JPEG screenshot of the current page as binary.
   */
  app.post("/browser/screenshot", async (req, reply) => {
    const body = parse(ScreenshotBodySchema, req.body);
    const buf = await manager.screenshot(body.contextId);

    if (!buf) {
      // Throttled or context gone — return 204 so the client skips this frame.
      return reply.code(204).send();
    }

    reply.header("Content-Type", "image/jpeg");
    reply.header("Cache-Control", "no-store");
    return reply.send(buf);
  });

  /**
   * POST /api/v1/browser/action
   * Forward a user interaction to the Puppeteer page.
   */
  app.post("/browser/action", async (req, reply) => {
    const body = parse(ActionBodySchema, req.body);

    const action = (() => {
      switch (body.type) {
        case "click":
          return { type: "click" as const, x: body.x ?? 0, y: body.y ?? 0 };
        case "type":
          return { type: "type" as const, text: body.text ?? "" };
        case "navigate":
          return { type: "navigate" as const, url: body.url ?? "" };
        case "key":
          return { type: "key" as const, key: body.key ?? "" };
      }
    })();

    await manager.action(body.contextId, action);

    // Return updated auth state so the client can upgrade guest → authenticated
    const handle = manager.getHandle(body.contextId);
    return reply.send({ ok: true, authState: handle?.authState ?? "guest" });
  });

  /**
   * DELETE /api/v1/browser/session/:contextId
   * Destroy a context (logout / cleanup).
   */
  app.delete("/browser/session/:contextId", async (req, reply) => {
    const { contextId } = req.params as { contextId: string };
    await manager.destroyContext(contextId);
    return reply.send({ ok: true });
  });
};

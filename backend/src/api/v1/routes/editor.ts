import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDb } from "../../../db/client.js";
import { ProjectsRepo } from "../../../db/repositories/projects.repo.js";
import { assembleRetrievalContext } from "../../../services/rag/index.js";
import { streamCompletion } from "../../../services/completion/provider.js";
import { streamOpenCode } from "../../../services/opencode/client.js";
import { pipeCompletionToSse, SSE_HEADERS } from "../../../services/completion/stream.js";
import type { CompletionChunk } from "../../../types/domain.js";
import { getUserId, requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/errors.js";
import { parse } from "../middleware/validate.js";
import { CompleteBodySchema } from "../schemas/editor.schema.js";

/** Extend the base schema with an optional provider discriminator. */
const CompleteBodyWithProviderSchema = CompleteBodySchema.extend({
  provider: z.enum(["grok", "venice", "opencode"]).optional().default("grok"),
  /** OpenCode session id — reuse across requests for conversation continuity */
  openCodeSessionId: z.string().optional(),
});

/**
 * POST /api/v1/editor/complete — streaming FIM completion.
 *
 * Dispatches to:
 *   - Grok / Venice path → existing streamCompletion() (OpenAI-compat)
 *   - OpenCode path      → streamOpenCode()
 *
 * Both paths share the same RAG retrieval so context is identical regardless
 * of which AI surface is active.
 */
export const editorRoutes: FastifyPluginAsync = async (app) => {
  app.post("/editor/complete", { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) throw AppError.unauthorized();

    const body = parse(CompleteBodyWithProviderSchema, req.body);
    const db = getDb();

    const project = await new ProjectsRepo(db).getOwned(body.projectId, userId);
    if (!project) throw AppError.notFound("Project not found");

    // 1) RAG retrieval — same for all providers.
    const payload = await assembleRetrievalContext(db, {
      projectId: body.projectId,
      language: body.language,
      prefix: body.prefix,
      suffix: body.suffix,
      instruction: body.instruction,
      graphSymbols: body.graphSymbols,
      tokenBudget: body.tokenBudget,
    });

    // 2) Open the SSE stream.
    const controller = new AbortController();
    reply.raw.on("close", () => controller.abort());

    reply.hijack();
    reply.raw.writeHead(200, SSE_HEADERS);

    async function* events(): AsyncGenerator<CompletionChunk> {
      // Always emit context first so the client can render retrieved snippets.
      yield { type: "context", contextBlocks: payload.contextBlocks };

      if (body.provider === "opencode") {
        yield* streamOpenCode({
          prompt: payload.prompt,
          sessionId: body.openCodeSessionId,
          signal: controller.signal,
        });
      } else {
        // grok | venice — both use the configured OpenAI-compat endpoint.
        yield* streamCompletion({ prompt: payload.prompt, signal: controller.signal });
      }
    }

    await pipeCompletionToSse(reply.raw, events());
  });
};

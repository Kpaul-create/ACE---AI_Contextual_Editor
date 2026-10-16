import { z } from "zod";

/**
 * POST /editor/complete — the hot path. The client sends the cursor context and
 * receives an SSE stream of retrieved context + generated middle tokens.
 */
export const CompleteBodySchema = z.object({
  projectId: z.string().uuid(),
  fileId: z.string().uuid().optional(),
  language: z.string().min(1).max(40),
  prefix: z.string().max(200_000),
  suffix: z.string().max(200_000),
  cursor: z.object({
    line: z.number().int().positive(),
    column: z.number().int().nonnegative(),
  }),
  instruction: z.string().max(2000).optional(),
  graphSymbols: z.array(z.string().min(1).max(200)).max(64).optional(),
  tokenBudget: z.number().int().positive().max(128_000).optional(),
});

export type CompleteBody = z.infer<typeof CompleteBodySchema>;

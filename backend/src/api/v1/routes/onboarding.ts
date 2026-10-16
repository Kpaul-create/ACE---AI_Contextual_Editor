import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../../../db/client";
import { ProfilesRepo } from "../../../db/repositories/profiles.repo";
import { provisionWorkspace } from "../../../services/onboarding/provisioner";
import { getUserId, requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errors";
import { parse } from "../middleware/validate";
import { OnboardingBodySchema } from "../schemas/onboarding.schema";

/**
 * POST /api/v1/onboarding
 * Finalizes the wizard: persists preferences and idempotently provisions the
 * starter workspace. The Clerk webhook may also trigger this; both paths converge
 * on the same idempotent provisioner.
 */
export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  app.post("/onboarding", { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    if (!userId) throw AppError.unauthorized();

    const body = parse(OnboardingBodySchema, req.body);
    const db = getDb();

    await provisionWorkspace(db, userId, {
      workspaceName: body.workspaceName,
      primaryLanguage: body.primaryLanguage,
      theme: body.theme,
    });

    const profile = await new ProfilesRepo(db).get(userId);
    return { profile };
  });
};

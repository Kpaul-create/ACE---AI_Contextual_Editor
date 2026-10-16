import type { FastifyPluginAsync } from "fastify";
import { onboardingRoutes } from "./routes/onboarding.js";
import { projectRoutes } from "./routes/projects.js";
import { fileRoutes } from "./routes/files.js";
import { editorRoutes } from "./routes/editor.js";
import { browserRoutes } from "./routes/browser.js";

/**
 * v1 API surface. Each route file is an independent Fastify plugin so it can be
 * tested in isolation; this module is the registration table.
 */
export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(onboardingRoutes);
  await app.register(projectRoutes);
  await app.register(fileRoutes);
  await app.register(editorRoutes);
  await app.register(browserRoutes);
};

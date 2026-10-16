import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../../../db/client";
import { ProjectsRepo } from "../../../db/repositories/projects.repo";
import { getUserId, requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errors";
import { parse } from "../middleware/validate";
import {
  CreateProjectSchema,
  ProjectIdParamSchema,
  UpdateProjectSchema,
} from "../schemas/project.schema";

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/projects", async (req) => {
    const userId = getUserId(req)!;
    const projects = await new ProjectsRepo(getDb()).listByOwner(userId);
    return { projects };
  });

  app.post("/projects", async (req, reply) => {
    const userId = getUserId(req)!;
    const body = parse(CreateProjectSchema, req.body);
    const project = await new ProjectsRepo(getDb()).create(userId, body);
    reply.code(201);
    return { project };
  });

  app.get("/projects/:id", async (req) => {
    const userId = getUserId(req)!;
    const { id } = parse(ProjectIdParamSchema, req.params);
    const project = await new ProjectsRepo(getDb()).getOwned(id, userId);
    if (!project) throw AppError.notFound("Project not found");
    return { project };
  });

  app.patch("/projects/:id", async (req) => {
    const userId = getUserId(req)!;
    const { id } = parse(ProjectIdParamSchema, req.params);
    const patch = parse(UpdateProjectSchema, req.body);
    const project = await new ProjectsRepo(getDb()).updateOwned(id, userId, patch);
    if (!project) throw AppError.notFound("Project not found");
    return { project };
  });

  app.delete("/projects/:id", async (req, reply) => {
    const userId = getUserId(req)!;
    const { id } = parse(ProjectIdParamSchema, req.params);
    const removed = await new ProjectsRepo(getDb()).removeOwned(id, userId);
    if (!removed) throw AppError.notFound("Project not found");
    reply.code(204);
    return null;
  });
};

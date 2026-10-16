import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../../../db/client";
import { FilesRepo } from "../../../db/repositories/files.repo";
import { ProjectsRepo } from "../../../db/repositories/projects.repo";
import { ChunksRepo } from "../../../db/repositories/chunks.repo";
import { indexFile } from "../../../services/rag";
import { getUserId, requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errors";
import { parse } from "../middleware/validate";
import {
  CreateFileSchema,
  FileIdParamSchema,
  ListFilesQuerySchema,
  UpdateFileSchema,
} from "../schemas/file.schema";

/** Assert the caller owns the project a file belongs to. */
async function assertOwnedProject(projectId: string, userId: string): Promise<void> {
  const project = await new ProjectsRepo(getDb()).getOwned(projectId, userId);
  if (!project) throw AppError.notFound("Project not found");
}

export const fileRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/files", async (req) => {
    const userId = getUserId(req)!;
    const { projectId } = parse(ListFilesQuerySchema, req.query);
    await assertOwnedProject(projectId, userId);
    const files = await new FilesRepo(getDb()).listByProject(projectId);
    return { files };
  });

  app.post("/files", async (req, reply) => {
    const userId = getUserId(req)!;
    const body = parse(CreateFileSchema, req.body);
    await assertOwnedProject(body.projectId, userId);
    const db = getDb();
    const files = new FilesRepo(db);
    const file = await files.upsert(body.projectId, {
      path: body.path,
      language: body.language,
      content: body.content,
    });

    // Index synchronously on create: files are usually small and the editor
    // expects retrieval to work immediately.
    const chunks = await indexFile(db, {
      fileId: file.id,
      projectId: file.project_id,
      path: file.path,
      language: file.language,
      content: file.content,
      contentHash: file.content_hash,
    });

    reply.code(201);
    return { file, chunks };
  });

  app.get("/files/:id", async (req) => {
    const userId = getUserId(req)!;
    const { id } = parse(FileIdParamSchema, req.params);
    const file = await new FilesRepo(getDb()).get(id);
    if (!file) throw AppError.notFound("File not found");
    await assertOwnedProject(file.project_id, userId);
    return { file };
  });

  app.patch("/files/:id", async (req, reply) => {
    const userId = getUserId(req)!;
    const { id } = parse(FileIdParamSchema, req.params);
    const body = parse(UpdateFileSchema, req.body);

    const db = getDb();
    const files = new FilesRepo(db);
    const existing = await files.get(id);
    if (!existing) throw AppError.notFound("File not found");
    await assertOwnedProject(existing.project_id, userId);

    const file = await files.updateContent(id, body.content);
    if (!file) throw AppError.notFound("File not found");

    let chunks: number | undefined;
    if (body.reindex) {
      chunks = await indexFile(db, {
        fileId: file.id,
        projectId: file.project_id,
        path: file.path,
        language: file.language,
        content: file.content,
        contentHash: file.content_hash,
      });
    }

    reply.code(200);
    return { file, chunks };
  });

  app.delete("/files/:id", async (req, reply) => {
    const userId = getUserId(req)!;
    const { id } = parse(FileIdParamSchema, req.params);
    const files = new FilesRepo(getDb());
    const existing = await files.get(id);
    if (!existing) throw AppError.notFound("File not found");
    await assertOwnedProject(existing.project_id, userId);
    await files.remove(id);
    reply.code(204);
    return null;
  });

  // Debug/inspection: what retrieval units exist for a file?
  app.get("/files/:id/chunks", async (req) => {
    const userId = getUserId(req)!;
    const { id } = parse(FileIdParamSchema, req.params);
    const file = await new FilesRepo(getDb()).get(id);
    if (!file) throw AppError.notFound("File not found");
    await assertOwnedProject(file.project_id, userId);
    const chunks = await new ChunksRepo(getDb()).listByFile(id);
    return { chunks };
  });
};

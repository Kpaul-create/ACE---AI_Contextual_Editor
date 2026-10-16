import { z } from "zod";

export const CreateFileSchema = z.object({
  projectId: z.string().uuid(),
  path: z.string().min(1).max(1024),
  language: z.string().min(1).max(40).default("plaintext"),
  content: z.string().default(""),
});

export const UpdateFileSchema = z.object({
  content: z.string(),
  /** When false, skip re-indexing (e.g. transient keystroke sync). */
  reindex: z.boolean().default(true),
});

export const ListFilesQuerySchema = z.object({
  projectId: z.string().uuid(),
});

export const FileIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateFileInput = z.infer<typeof CreateFileSchema>;
export type UpdateFileInput = z.infer<typeof UpdateFileSchema>;

import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  language: z.string().min(1).max(40).default("typescript"),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export const ProjectIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

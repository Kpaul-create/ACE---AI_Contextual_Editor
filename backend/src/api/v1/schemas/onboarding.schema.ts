import { z } from "zod";

/** POST /onboarding — capture workspace preferences for the signed-in user. */
export const OnboardingBodySchema = z.object({
  workspaceName: z.string().min(1).max(120).optional(),
  primaryLanguage: z.string().min(1).max(40).default("typescript"),
  theme: z.enum(["dark", "light"]).default("dark"),
  seedStarterProject: z.boolean().default(true),
});

export type OnboardingBody = z.infer<typeof OnboardingBodySchema>;

import { ServerEnvSchema } from "../../../secrets/schema";

/**
 * Runtime configuration.
 *
 * The schema lives in `secrets/schema.ts` so the boot path and the CI gate
 * (secrets/validate-env.ts) can never drift. Parsing happens at import time and
 * throws on any missing/mismatched value — fail-closed before the server binds.
 */
const parsed = ServerEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === "production";

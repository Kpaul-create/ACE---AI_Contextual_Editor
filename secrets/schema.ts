import { z } from "zod";

/**
 * Single source of truth for environment configuration, shared by the runtime
 * (backend/src/config/env.ts) and the CLI/CI gate (validate-env.ts).
 *
 * Two object schemas (server-only vs public) plus refinements that cross-verify
 * values across keys — presence checks alone are theatre.
 */

/** Must match the vector width declared in backend/src/db/schema.sql. */
export const EXPECTED_EMBEDDING_DIM = 1536;

const SECRET_KEY_PREFIXES = ["sk_", "whsec_", "sb_", "service_role", "eyJ"];

/** Substrings that indicate an unfilled template value. Must never reach prod. */
const PLACEHOLDER_MARKERS = [
  "replace_me",
  "replace-me",
  "your-",
  "your_",
  "<from",
  "changeme",
  "change_me",
  "placeholder",
  "xxxx",
];

/** Required values we refuse to accept as unfilled placeholders. */
const NON_PLACEHOLDER_KEYS = [
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EMBEDDING_API_KEY",
  "COMPLETION_API_KEY",
] as const;

function isPlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((m) => v.includes(m));
}

export const ServerEnvObject = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // --- Clerk -----------------------------------------------------------------
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_WEBHOOK_SECRET: z.string().min(1, "CLERK_WEBHOOK_SECRET is required"),

  // --- Supabase --------------------------------------------------------------
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Optional direct Postgres URI (migrations / psql); not used by the app path. */
  DATABASE_URL: z.string().url().optional(),

  // --- Embeddings ------------------------------------------------------------
  EMBEDDING_PROVIDER: z.string().default("openai"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIM: z.coerce.number().int().positive().default(EXPECTED_EMBEDDING_DIM),
  EMBEDDING_API_KEY: z.string().min(1),
  EMBEDDING_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(64),

  // --- Completion (CLM / FIM) ------------------------------------------------
  COMPLETION_PROVIDER: z
    .enum(["openai", "anthropic", "deepinfra"])
    .default("deepinfra"),
  COMPLETION_MODEL: z.string().default("deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct"),
  COMPLETION_API_KEY: z.string().min(1),
  COMPLETION_BASE_URL: z.string().url().optional(),
  COMPLETION_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  COMPLETION_MAX_TOKENS: z.coerce.number().int().positive().default(512),

  // --- Browser service --------------------------------------------------------
  /** Puppeteer user-data-dir for persistent profiles (git-ignored). */
  BROWSER_USER_DATA_DIR: z.string().default("./data/browser"),
  /** Max concurrent incognito contexts before evicting LRU. */
  BROWSER_MAX_CONTEXTS: z.coerce.number().int().positive().default(20),

  // --- OpenCode agent ---------------------------------------------------------
  /** Base URL of the local OpenCode agent (default: http://localhost:3001). */
  OPENCODE_BASE_URL: z.string().url().default("http://localhost:3001"),

  // --- RAG tuning ------------------------------------------------------------
  RAG_MATCH_COUNT: z.coerce.number().int().positive().default(12),
  RAG_LEXICAL_COUNT: z.coerce.number().int().positive().default(20),
  RAG_TOKEN_BUDGET: z.coerce.number().int().positive().default(4096),
  RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.15),
  RRF_K: z.coerce.number().int().positive().default(60),
  CHUNK_MAX_TOKENS: z.coerce.number().int().positive().default(512),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().int().nonnegative().default(64),
});

/** Browser-exposed variables. These are inlined into the client bundle. */
export const PublicEnvObject = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_CLOUD_SYNC_ENDPOINT: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvObject>;

/** Cross-key checks that a per-field schema cannot express. */
function serverRefinements(env: ServerEnv, ctx: z.RefinementCtx): void {
  // Clerk: test keys must pair with test keys, live with live.
  const sk = env.CLERK_SECRET_KEY;
  if (sk.startsWith("sk_test_") && sk.startsWith("sk_live_")) {
    ctx.addIssue({ code: "custom", path: ["CLERK_SECRET_KEY"], message: "ambiguous Clerk secret key" });
  }
  if (!sk.startsWith("sk_")) {
    ctx.addIssue({
      code: "custom",
      path: ["CLERK_SECRET_KEY"],
      message: "Clerk secret key should start with 'sk_test_' or 'sk_live_'",
    });
  }
  if (!env.CLERK_WEBHOOK_SECRET.startsWith("whsec_")) {
    ctx.addIssue({
      code: "custom",
      path: ["CLERK_WEBHOOK_SECRET"],
      message: "Clerk webhook secret should start with 'whsec_'",
    });
  }

  // Supabase: a publishable/anon key must never be used as service role.
  const srk = env.SUPABASE_SERVICE_ROLE_KEY;
  if (srk.startsWith("sb_publishable_") || srk === "anon" || srk.startsWith("sb_anon")) {
    ctx.addIssue({
      code: "custom",
      path: ["SUPABASE_SERVICE_ROLE_KEY"],
      message: "looks like a publishable/anon key — service-role key required",
    });
  }

  // Embedding dim must match the pgvector column width or every insert corrupts.
  if (env.EMBEDDING_DIM !== EXPECTED_EMBEDDING_DIM) {
    ctx.addIssue({
      code: "custom",
      path: ["EMBEDDING_DIM"],
      message: `must equal ${EXPECTED_EMBEDDING_DIM} to match schema.sql vector(${EXPECTED_EMBEDDING_DIM})`,
    });
  }

  // Refuse to start on unfilled template values.
  for (const key of NON_PLACEHOLDER_KEYS) {
    if (isPlaceholder(env[key])) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "looks like an unfilled placeholder — set a real value",
      });
    }
  }

  // Non-local endpoints must be TLS.
  if (env.NODE_ENV === "production") {
    if (!env.SUPABASE_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["SUPABASE_URL"], message: "must be https in production" });
    }
    if (env.COMPLETION_BASE_URL && !env.COMPLETION_BASE_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["COMPLETION_BASE_URL"],
        message: "must be https in production",
      });
    }
  }
}

const PUBLIC_ENV_KEYS = Object.keys(PublicEnvObject.shape) as Array<
  keyof z.infer<typeof PublicEnvObject>
>;

function publicRefinements(
  env: z.infer<typeof PublicEnvObject>,
  ctx: z.RefinementCtx,
): void {
  for (const key of PUBLIC_ENV_KEYS) {
    const value = env[key];
    if (typeof value !== "string" || value.length === 0) continue;
    if (isPlaceholder(value)) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "looks like an unfilled placeholder — set a real value",
      });
      continue;
    }
    if (SECRET_KEY_PREFIXES.some((p) => value.toLowerCase().startsWith(p))) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "NEXT_PUBLIC_* values are inlined into the browser bundle and must not look like secrets",
      });
    }
  }
}

/** Server-only schema for the runtime. */
export const ServerEnvSchema = ServerEnvObject.superRefine(serverRefinements);

/** Full schema (server + public) for the CLI/CI gate. */
export const EnvSchema = ServerEnvObject.merge(PublicEnvObject)
  .superRefine(serverRefinements)
  .superRefine((env, ctx) => publicRefinements(env, ctx));

export type PublicEnv = z.infer<typeof PublicEnvObject>;
export type FullEnv = z.infer<typeof EnvSchema>;

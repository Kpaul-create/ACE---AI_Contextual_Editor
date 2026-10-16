import { pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { EnvSchema, type FullEnv } from "./schema";

/**
 * Environment validation gate.
 *
 * Importable (`validateEnv()`) and runnable as a CLI:
 *   tsx secrets/validate-env.ts            # validates process.env
 *   tsx secrets/validate-env.ts --file .env.test
 *
 * Exits non-zero on failure so `predev`/`pretest`/CI block a misconfigured boot.
 */

export type ValidationResult =
  | { ok: true; data: FullEnv }
  | { ok: false; issues: Array<{ path: string; message: string }> };

export function validateEnv(source: NodeJS.ProcessEnv = process.env): ValidationResult {
  const parsed = EnvSchema.safeParse(source);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message,
    })),
  };
}

export function formatIssues(issues: Array<{ path: string; message: string }>): string {
  // Only key names + shapes are printed; values are never included.
  return issues.map((i) => `  ✗ ${i.path}: ${i.message}`).join("\n");
}

/** Minimal .env parser (KEY=VALUE, ignores comments/blanks/export prefix). */
export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnvFile(path: string): NodeJS.ProcessEnv {
  if (!existsSync(path)) {
    console.error(`✗ env file not found: ${path}`);
    process.exit(1);
  }
  return parseEnvFile(readFileSync(path, "utf8")) as NodeJS.ProcessEnv;
}

function runCli(): void {
  const fileIdx = process.argv.indexOf("--file");
  const source =
    fileIdx !== -1 && process.argv[fileIdx + 1]
      ? loadEnvFile(process.argv[fileIdx + 1]!)
      : process.env;

  const result = validateEnv(source);
  if (result.ok) {
    console.log("✓ environment valid");
    return;
  }
  console.error("✗ environment validation failed:\n" + formatIssues(result.issues));
  process.exit(1);
}

// Run only when invoked directly (`tsx secrets/validate-env.ts ...`).
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  runCli();
}

export { z };

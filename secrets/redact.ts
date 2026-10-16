/**
 * Redaction helpers. Validation output and logs reference key *names* and
 * shapes only — never secret values. Defense-in-depth for accidental dumps.
 */

const SENSITIVE_PATTERN =
  /(KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|URI|URL|DATABASE|CREDENTIAL|DSN)/i;

/** Mask a single value, preserving enough to recognize it (never the whole). */
export function redactValue(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "«set»";
  if (value.length <= 8) return "«redacted»";
  return `${value.slice(0, 3)}…${value.slice(-2)} «redacted»`;
}

/** Clone an env map with sensitive values masked. */
export function redactEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    out[key] = SENSITIVE_PATTERN.test(key) ? redactValue(value) : value;
  }
  return out;
}

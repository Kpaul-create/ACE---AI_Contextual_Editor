/**
 * Per-user cookie store — persists Puppeteer cookies to disk so sessions
 * survive server restarts. Files are git-ignored via .gitignore rule.
 *
 * Path: backend/data/cookies/<userId>/<provider>.json
 *
 * We use a plain serializable type rather than Protocol.Network.CookieParam
 * to avoid version-skew issues between puppeteer's internal CDP types.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/** Minimal cookie shape we need to persist and restore. */
export interface StoredCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  [key: string]: unknown;
}

const DATA_DIR = join(process.cwd(), "data", "cookies");

function cookiePath(userId: string, provider: string): string {
  return join(DATA_DIR, userId, `${provider}.json`);
}

export async function loadCookies(
  userId: string,
  provider: string,
): Promise<StoredCookie[]> {
  try {
    const raw = await readFile(cookiePath(userId, provider), "utf8");
    return JSON.parse(raw) as StoredCookie[];
  } catch {
    return [];
  }
}

export async function saveCookies(
  userId: string,
  provider: string,
  cookies: StoredCookie[],
): Promise<void> {
  const dir = join(DATA_DIR, userId);
  await mkdir(dir, { recursive: true });
  await writeFile(cookiePath(userId, provider), JSON.stringify(cookies, null, 2));
}

export async function clearCookies(userId: string, provider: string): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(cookiePath(userId, provider));
  } catch {
    /* already gone */
  }
}

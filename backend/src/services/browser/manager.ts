/**
 * Singleton Puppeteer browser manager.
 *
 * ONE browser process per server. Per-user incognito BrowserContexts are
 * created on demand and reused. Contexts are never shared across users.
 */

import type { Browser, BrowserContext, Page } from "puppeteer";
import { loadCookies, saveCookies, type StoredCookie } from "./cookie-store.js";

export type Provider = "grok" | "venice" | "opencode";

export interface BrowserContextHandle {
  contextId: string;
  userId: string;
  provider: Provider;
  authState: "guest" | "authenticated" | "expired";
}

interface ContextEntry {
  handle: BrowserContextHandle;
  context: BrowserContext;
  page: Page;
}

const PROVIDER_URLS: Record<Provider, string> = {
  grok:     "https://grok.x.com",
  venice:   "https://venice.ai",
  opencode: "http://localhost:3001",
};

const SCREENSHOT_THROTTLE_MS = 200;

class BrowserManager {
  private browser: Browser | null = null;
  private contexts = new Map<string, ContextEntry>();
  private lastScreenshot = new Map<string, number>();

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    const puppeteer = await import("puppeteer").catch(() => null);
    if (!puppeteer) throw new Error("puppeteer not installed");

    this.browser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    this.browser.on("disconnected", () => {
      this.browser = null;
      this.contexts.clear();
    });

    return this.browser;
  }

  private contextId(userId: string, provider: Provider): string {
    return `${userId}::${provider}`;
  }

  async getOrCreateContext(
    userId: string,
    provider: Provider,
  ): Promise<BrowserContextHandle> {
    const id = this.contextId(userId, provider);
    const existing = this.contexts.get(id);
    if (existing) return existing.handle;

    const browser = await this.ensureBrowser();
    const context = await browser.createBrowserContext();

    const stored = await loadCookies(userId, provider);
    if (stored.length > 0) {
      // Only pass cookies that have the required domain field
      const valid = stored.filter(
        (c): c is StoredCookie & { domain: string } =>
          typeof c.domain === "string" && c.domain.length > 0,
      );
      if (valid.length > 0) {
        // setCookie accepts CookieParam[] — our StoredCookie is structurally compatible
        await context.setCookie(
          ...(valid as Parameters<typeof context.setCookie>),
        );
      }
    }

    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(PROVIDER_URLS[provider], { waitUntil: "domcontentloaded" }).catch(() => null);

    const authState = stored.length > 0 ? "authenticated" : "guest";
    const handle: BrowserContextHandle = { contextId: id, userId, provider, authState };

    this.contexts.set(id, { handle, context, page });
    return handle;
  }

  async screenshot(contextId: string): Promise<Buffer | null> {
    const entry = this.contexts.get(contextId);
    if (!entry) return null;

    const now = Date.now();
    const last = this.lastScreenshot.get(contextId) ?? 0;
    if (now - last < SCREENSHOT_THROTTLE_MS) return null;
    this.lastScreenshot.set(contextId, now);

    try {
      const buf = await entry.page.screenshot({ type: "jpeg", quality: 75 });
      return Buffer.from(buf);
    } catch {
      return null;
    }
  }

  async action(
    contextId: string,
    action:
      | { type: "click"; x: number; y: number }
      | { type: "type"; text: string }
      | { type: "navigate"; url: string }
      | { type: "key"; key: string },
  ): Promise<void> {
    const entry = this.contexts.get(contextId);
    if (!entry) return;

    const { page } = entry;
    switch (action.type) {
      case "click":
        await page.mouse.click(action.x, action.y);
        break;
      case "type":
        await page.keyboard.type(action.text);
        break;
      case "navigate":
        await page.goto(action.url, { waitUntil: "domcontentloaded" }).catch(() => null);
        break;
      case "key":
        await page.keyboard.press(action.key as Parameters<typeof page.keyboard.press>[0]);
        break;
    }

    await this.persistCookies(contextId);
  }

  private async persistCookies(contextId: string): Promise<void> {
    const entry = this.contexts.get(contextId);
    if (!entry) return;
    try {
      const cookies = await entry.context.cookies();
      // Puppeteer's Cookie type is a superset of StoredCookie — safe to cast
      await saveCookies(entry.handle.userId, entry.handle.provider, cookies as unknown as StoredCookie[]);
      if (cookies.length > 0 && entry.handle.authState === "guest") {
        entry.handle.authState = "authenticated";
      }
    } catch {
      /* non-fatal */
    }
  }

  getHandle(contextId: string): BrowserContextHandle | null {
    return this.contexts.get(contextId)?.handle ?? null;
  }

  async destroyContext(contextId: string): Promise<void> {
    const entry = this.contexts.get(contextId);
    if (!entry) return;
    await entry.context.close().catch(() => null);
    this.contexts.delete(contextId);
    this.lastScreenshot.delete(contextId);
  }

  async shutdown(): Promise<void> {
    await this.browser?.close().catch(() => null);
    this.browser = null;
    this.contexts.clear();
  }
}

let _manager: BrowserManager | null = null;

export function getBrowserManager(): BrowserManager {
  _manager ??= new BrowserManager();
  return _manager;
}

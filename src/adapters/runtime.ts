/**
 * WorkspaceRuntime adapter.
 *
 * Abstracts where files live and how code executes.
 * Call sites depend ONLY on this interface — never on a concrete impl.
 *
 * Implementations:
 *   ServerRuntime        — current: PUT to NEXT_PUBLIC_CLOUD_SYNC_ENDPOINT
 *   WebContainerRuntime  — Phase 8: @webcontainer/api in-browser
 */

import type { WorkspaceFile } from "@/types/workspace";

/* ── Interface ───────────────────────────────────────────────────────────── */

export interface WorkspaceRuntime {
  /** Write a batch of files to the backing store. */
  writeFiles(projectId: string, files: WorkspaceFile[]): Promise<void>;

  /** Read a single file by path. Returns null if not found. */
  readFile(projectId: string, path: string): Promise<string | null>;

  /** Execute a shell command. Returns stdout. */
  exec(command: string): Promise<string>;

  /** Boot a dev server and return its URL. */
  spawnDevServer(): Promise<string>;

  /** Snapshot the current workspace to a portable blob. */
  snapshot(): Promise<Blob>;

  /** Hydrate from a snapshot blob. */
  hydrate(blob: Blob): Promise<void>;

  /** Tear down — release resources. */
  dispose(): Promise<void>;
}

/* ── ServerRuntime — wraps the existing cloud-sync fetch call ────────────── */

export class ServerRuntime implements WorkspaceRuntime {
  async writeFiles(projectId: string, files: WorkspaceFile[]): Promise<void> {
    const endpoint = process.env.NEXT_PUBLIC_CLOUD_SYNC_ENDPOINT;
    if (!endpoint) {
      throw new Error(
        "Cloud sync is not configured. Set NEXT_PUBLIC_CLOUD_SYNC_ENDPOINT.",
      );
    }
    const res = await fetch(
      `${endpoint.replace(/\/$/, "")}/workspaces/${encodeURIComponent(projectId)}/files`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      },
    );
    if (!res.ok) {
      throw new Error(`Cloud sync failed with status ${res.status}.`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async readFile(_projectId: string, _path: string): Promise<string | null> {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exec(_command: string): Promise<string> {
    throw new Error("exec() not available in ServerRuntime.");
  }

  async spawnDevServer(): Promise<string> {
    throw new Error("spawnDevServer() not available in ServerRuntime.");
  }

  async snapshot(): Promise<Blob> {
    throw new Error("snapshot() not available in ServerRuntime.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async hydrate(_blob: Blob): Promise<void> {
    throw new Error("hydrate() not available in ServerRuntime.");
  }

  async dispose(): Promise<void> { /* nothing */ }
}

/* ── WebContainerRuntime — Phase 8 ──────────────────────────────────────── */

/**
 * Lazily boots a WebContainer instance on first use.
 * Requires COOP + COEP headers (crossOriginIsolated === true) — set in Phase 3.
 * One instance per page — WebContainer enforces a singleton per origin.
 */
export class WebContainerRuntime implements WorkspaceRuntime {
  private _instance: import("@webcontainer/api").WebContainer | null = null;
  private _booting: Promise<import("@webcontainer/api").WebContainer> | null = null;
  private _devServerUrl: string | null = null;

  private async boot(): Promise<import("@webcontainer/api").WebContainer> {
    if (this._instance) return this._instance;
    if (this._booting) return this._booting;

    this._booting = (async () => {
      const { WebContainer } = await import("@webcontainer/api");
      const wc = await WebContainer.boot();
      this._instance = wc;
      return wc;
    })();

    return this._booting;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async writeFiles(_projectId: string, files: WorkspaceFile[]): Promise<void> {
    const wc = await this.boot();
    const tree: Record<string, { file: { contents: string } }> = {};
    for (const f of files) {
      tree[f.path] = { file: { contents: f.content } };
    }
    await wc.mount(tree);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async readFile(_projectId: string, path: string): Promise<string | null> {
    const wc = await this.boot();
    try {
      return await wc.fs.readFile(path, "utf-8");
    } catch {
      return null;
    }
  }

  async exec(command: string): Promise<string> {
    const wc = await this.boot();
    const [cmd, ...args] = command.split(" ");
    const proc = await wc.spawn(cmd, args);
    const chunks: string[] = [];
    await proc.output.pipeTo(
      new WritableStream<string>({
        write(chunk) {
          chunks.push(chunk);
        },
      }),
    );
    const exit = await proc.exit;
    if (exit !== 0) throw new Error(`Command exited with code ${exit}`);
    return chunks.join("");
  }

  async spawnDevServer(): Promise<string> {
    if (this._devServerUrl) return this._devServerUrl;
    const wc = await this.boot();

    return new Promise((resolve, reject) => {
      wc.on("server-ready", (_port, url) => {
        this._devServerUrl = url;
        resolve(url);
      });
      wc.spawn("npx", ["serve", ".", "--no-clipboard"]).catch(reject);
    });
  }

  async snapshot(): Promise<Blob> {
    const wc = await this.boot();
    const entries: Array<{ path: string; content: string }> = [];

    async function walk(dir: string) {
      const items = await wc.fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const full = dir === "/" ? `/${item.name}` : `${dir}/${item.name}`;
        if (item.isDirectory()) {
          await walk(full);
        } else {
          const content = await wc.fs.readFile(full, "utf-8");
          entries.push({ path: full, content });
        }
      }
    }

    await walk("/");
    return new Blob([JSON.stringify(entries)], { type: "application/json" });
  }

  async hydrate(blob: Blob): Promise<void> {
    const wc = await this.boot();
    const entries = JSON.parse(await blob.text()) as Array<{ path: string; content: string }>;
    const tree: Record<string, { file: { contents: string } }> = {};
    for (const e of entries) tree[e.path] = { file: { contents: e.content } };
    await wc.mount(tree);
  }

  async dispose(): Promise<void> {
    this._instance?.teardown();
    this._instance = null;
    this._booting  = null;
    this._devServerUrl = null;
  }
}

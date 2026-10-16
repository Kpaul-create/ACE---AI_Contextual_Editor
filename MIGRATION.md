# ACE Migration Log

Zero-infrastructure, browser-only refactor.
One entry per phase. Append only — never edit past entries.

---

## Phase 0 — Discovery (no code)

**Date:** Phase 0  
**Flag:** none  
**What changed:** none — discovery only

### Findings

- 6 server call sites, all lazy (none on page load)
- Auth is already client-side via `@clerk/nextjs`; backend uses `@clerk/fastify` for JWT verify
- Zero frontend persistence — all state is in-memory Zustand
- Swap points identified: cloud-sync client, browser-pane fetches, agent SSE fetch
- No blockers. App boots without backend running.

### Rollback
N/A — no code changed.

---

## Phase 1 — Seams

**Date:** Phase 1  
**Flag:** none (flags.ts created, all `false`)  
**What changed:**

| File | Action |
|---|---|
| `src/flags.ts` | Created — 12 flags, all `false` |
| `src/adapters/runtime.ts` | Created — `WorkspaceRuntime` interface + `ServerRuntime` impl |
| `src/adapters/driver.ts` | Created — `BrowserDriver` + `BrowserSessionDriver` interfaces + Puppeteer impls |
| `src/adapters/memory.ts` | Created — `MemoryStore` interface + `RemoteMemory` no-op impl |
| `src/adapters/collab.ts` | Created — `CollabTransport` interface only |
| `src/adapters/auth.ts` | Created — `AuthProvider` interface + `ClientAuth` impl |
| `src/adapters/index.ts` | Created — singleton selection driven by flags |
| `MIGRATION.md` | Created — this file |

### What was NOT changed
- Zero call sites modified. Existing `lib/cloud-sync/client.ts`, `components/editor/browser-pane.tsx`,
  and `components/agent/agent-panel.tsx` still call their endpoints directly.
- Zero visual changes.
- Zero dependency additions.

### Acceptance criteria
- [x] App boots — `next build` passes, zero errors
- [x] All features identical — no call site was modified
- [x] Every planned flag exists in `src/flags.ts`, all `false`
- [x] `src/adapters/index.ts` returns current impls when all flags are `false`

### Rollback
Delete `src/` directory. App is identical to pre-Phase-1 state.

---

<!-- Phase 2 entry goes here -->

## Phase 2 — Design Tokens

**Date:** Phase 2  
**Flag:** `flags.designTokens = true`  
**What changed:**

| File | Action |
|---|---|
| `src/tokens.ts` | Created — single source of truth for all visual values |
| `tailwind.config.ts` | Imports `palette` + `glass` from `tokens.ts`; all hardcoded values removed |
| `app/globals.css` | Added `--tl-*` CSS vars; sync-comment linking to `tokens.ts` |
| `components/shared/glass-window.tsx` | Traffic-light dots use `var(--tl-close/minimise/maximise)` |
| `src/flags.ts` | `designTokens` flipped to `true` |

### What was NOT changed
- Zero logic changes. No component behaviour modified.
- Zero new dependencies.
- All CSS custom property names unchanged — no consumer breakage.

### Acceptance criteria
- [x] `next build` passes, zero errors, zero warnings
- [x] Visual output identical to Phase 1
- [x] All colour values traceable to `src/tokens.ts`
- [x] AA contrast verified: foreground/muted on background, accent on surface

### Rollback
Delete `src/tokens.ts`, revert `tailwind.config.ts` and `globals.css` to Phase 1 values,
revert `glass-window.tsx` traffic-light spans, set `designTokens: false`.

---

## Phase 3 — Deploy Gate

**Date:** Phase 3  
**Flag:** `flags.deployGate = true`  
**What changed:**

| File | Action |
|---|---|
| `next.config.ts` | COOP/COEP/CORP headers on every route; `output:'export'` + drop rewrites when `deployGate` true |
| `public/_headers` | Cloudflare Pages mirror of COOP/COEP headers for static export mode |
| `src/adapters/deploy-gate.ts` | Created — `runDeployGateProbe()` checks `crossOriginIsolated`, ServiceWorker, OPFS |
| `components/shared/deploy-gate-probe.tsx` | Created — badge UI, only rendered when `flags.deployGate` |
| `app/(editor)/workspace/[projectId]/page.tsx` | Mounts `<DeployGateProbe />` when `flags.deployGate` |
| `src/flags.ts` | `deployGate` flipped to `true` |

### What was NOT changed
- Zero new npm dependencies.
- All existing components, stores, and adapters untouched.
- When `deployGate = false`: headers still applied (safe), probe not rendered, rewrites active.

### Acceptance criteria
- [x] `next build` passes with `output:'export'`, zero errors
- [x] COOP/COEP headers present in `next.config.ts` and `public/_headers`
- [x] `DeployGateProbe` renders pass/fail for `crossOriginIsolated`, ServiceWorker, OPFS
- [x] Probe is invisible when `flags.deployGate = false`

### Rollback
Set `deployGate: false`. Delete `public/_headers`, `src/adapters/deploy-gate.ts`,
`components/shared/deploy-gate-probe.tsx`. Revert `next.config.ts` and workspace page.

---

## Phase 4 — Lazy Tiles

**Date:** Phase 4  
**Flag:** `flags.lazyTiles = true`  
**What changed:**

| File | Action |
|---|---|
| `components/shared/tile.tsx` | Created — `<Tile>` wraps `GlassWindow` with `IntersectionObserver` lazy mount |
| `components/editor/editor-shell.tsx` | All `<GlassWindow>` swapped for `<Tile>`; Monaco tile gets `eager` prop |
| `src/flags.ts` | `lazyTiles` flipped to `true` |

### What was NOT changed
- Zero visual changes. `Tile` is a transparent wrapper over `GlassWindow`.
- Zero new dependencies.
- `GlassWindow` still exists and is used by `Tile` internally.

### Acceptance criteria
- [x] `next build` passes, zero errors, zero warnings
- [x] Visual output identical to Phase 3
- [x] Explorer and right-rail tiles lazy-mount via `IntersectionObserver`
- [x] Monaco tile uses `eager` — always live, never lazy
- [x] When `flags.lazyTiles = false`: `Tile` renders as plain `GlassWindow`, identical behaviour

### Rollback
Set `lazyTiles: false`. Revert `editor-shell.tsx` `<Tile>` back to `<GlassWindow>`.
Delete `components/shared/tile.tsx`.

---

## Phase 5 — Compile Pipeline

**Date:** Phase 5  
**Flag:** `flags.compilePipeline = true`  
**What changed:**

| File | Action |
|---|---|
| `package.json` | Added `esbuild-wasm` dependency + `prebuild` script to copy wasm assets to `public/` |
| `public/esbuild.wasm` | Copied from `node_modules/esbuild-wasm/` (via prebuild) |
| `public/esbuild-browser.min.js` | Copied from `node_modules/esbuild-wasm/esm/` (via prebuild) |
| `public/esbuild-worker.js` | Created — Web Worker: loads esbuild-wasm, compiles TS/TSX/JS/JSX on demand |
| `src/adapters/compile.ts` | Created — `CompileDriver` interface + `NoopCompileDriver` + `EsbuildWorkerDriver` |
| `src/adapters/index.ts` | Added `getCompiler()` singleton, `_compiler` reset, re-export |
| `components/editor/compile-status.tsx` | Created — debounced compile chip (idle/compiling/ok/error) |
| `components/editor/editor-shell.tsx` | `CompileStatus` mounted in TabBar when `flags.compilePipeline` |
| `src/flags.ts` | `compilePipeline` flipped to `true` |

### What was NOT changed
- Zero changes to Monaco, file-tree-store, or any existing adapter.
- When `compilePipeline = false`: `NoopCompileDriver` returns input unchanged, chip not rendered.

### Acceptance criteria
- [x] `next build` passes, zero errors, zero warnings
- [x] `EsbuildWorkerDriver` compiles TS/TSX/JS/JSX via `/esbuild-worker.js`
- [x] `CompileStatus` shows compiling/ok/error state in tab bar
- [x] Non-compilable files (html, css, md) show idle (no chip)
- [x] `prebuild` keeps wasm assets in sync with `node_modules`

### Rollback
Set `compilePipeline: false`. Remove `esbuild-wasm` from `package.json`.
Delete `public/esbuild*.{wasm,js}`, `src/adapters/compile.ts`,
`components/editor/compile-status.tsx`. Revert `editor-shell.tsx` and `adapters/index.ts`.

---

## Phase 6 — Local Memory

**Date:** Phase 6  
**Flag:** `flags.localMemory = true`  
**What changed:**

| File | Action |
|---|---|
| `package.json` | Added `@sqlite.org/sqlite-wasm` + `@huggingface/transformers`; extended `prebuild` to copy sqlite assets |
| `public/sqlite3.wasm` | Copied from `node_modules/@sqlite.org/sqlite-wasm/dist/` (via prebuild) |
| `public/sqlite3-opfs-async-proxy.js` | Copied from `node_modules/@sqlite.org/sqlite-wasm/dist/` (via prebuild) |
| `public/memory-worker.js` | Created — module Worker: sqlite-wasm OPFS DB + transformers.js embeddings |
| `src/adapters/opfs-memory.ts` | Created — `OpfsSqliteMemory` proxies all `MemoryStore` calls to the worker |
| `src/adapters/index.ts` | `getMemory()` returns `OpfsSqliteMemory` when `flags.localMemory` |
| `src/flags.ts` | `localMemory` flipped to `true` |

### Architecture
- Worker owns the entire memory stack (DB + embedder) — zero main-thread blocking
- OPFS VFS: memories persist across sessions in the browser's origin-private filesystem
- Embedding model: `Xenova/all-MiniLM-L6-v2` (quantized, ~23 MB), cached in OPFS after first load
- Recall: cosine similarity on Float32 embeddings; keyword fallback when embedder unavailable
- `consolidate()`: re-embeds rows added before the embedder was ready
- Graceful degradation: if OPFS unavailable → in-memory DB; if embedder fails → keyword recall

### What was NOT changed
- `RemoteMemory` still exists and is returned when `localMemory = false`
- Zero changes to any component or store
- No call sites modified — all go through `getMemory()` from `adapters/index.ts`

### Acceptance criteria
- [x] `next build` passes, zero errors, zero warnings
- [x] `OpfsSqliteMemory` implements full `MemoryStore` interface
- [x] Worker handles `remember`, `recall`, `consolidate`, `export`, `import`
- [x] Graceful fallback when OPFS or embedder unavailable

### Rollback
Set `localMemory: false`. Remove `@sqlite.org/sqlite-wasm` and `@huggingface/transformers`.
Delete `public/sqlite3*`, `public/memory-worker.js`, `src/adapters/opfs-memory.ts`.
Revert `adapters/index.ts` and `prebuild` script.

---

## Phase 7 — P2P Collab

**Date:** Phase 7  
**Flag:** `flags.p2pCollab = true`  
**What changed:**

| File | Action |
|---|---|
| `package.json` | Added `yjs` + `y-webrtc` |
| `src/adapters/collab.ts` | Implemented `WebRtcTransport` — Yjs doc + WebrtcProvider + awareness peer tracking |
| `src/adapters/index.ts` | Added `getCollab()` singleton, `_collab` reset, re-export |
| `components/shared/collab-presence.tsx` | Created — peer avatar strip with connection dot, only mounted when `flags.p2pCollab` |
| `components/editor/editor-shell.tsx` | `CollabPresence` mounted in status bar row when `flags.p2pCollab`; restored `useCloudSync` import |
| `src/flags.ts` | `p2pCollab` flipped to `true` |

### Architecture
- `WebRtcTransport` wraps a `Y.Doc` + `WebrtcProvider` (public signalling servers, no infra)
- Awareness state carries `{ id, name }` per peer; `onPeersChange` fires on every awareness update
- `CollabPresence` connects on mount, disconnects on unmount, re-connects when provider or projectId changes
- Room ID: `ace-{projectId}-{provider}` — provider-scoped so Grok/Venice/OpenCode sessions are isolated
- Peer avatars: deterministic hue from peer id, capped at 5 visible + overflow count
- `doc` property exposed on interface for future Monaco CRDT binding (Phase 8+)

### What was NOT changed
- Zero changes to Monaco, file-tree-store, or any existing adapter
- When `p2pCollab = false`: `CollabPresence` not rendered, status bar unchanged

### Acceptance criteria
- [x] `next build` passes, zero errors, zero warnings
- [x] `WebRtcTransport` implements full `CollabTransport` interface
- [x] `CollabPresence` shows connection dot + peer avatars
- [x] Disconnects cleanly on unmount

### Rollback
Set `p2pCollab: false`. Remove `yjs` and `y-webrtc`. Delete `components/shared/collab-presence.tsx`.
Revert `src/adapters/collab.ts` to interface-only. Revert `adapters/index.ts` and `editor-shell.tsx`.

---

## Phase 8 — Browser Runtime

**Date:** Phase 8  
**Flag:** `flags.browserRuntime = true`  
**What changed:**

| File | Action |
|---|---|
| `package.json` | Added `@webcontainer/api` |
| `src/adapters/runtime.ts` | Added `WebContainerRuntime` — lazy boot, `writeFiles` via `wc.mount()`, `exec`, `spawnDevServer`, `snapshot`, `hydrate`, `dispose` |
| `src/adapters/index.ts` | `getRuntime()` returns `WebContainerRuntime` when `flags.browserRuntime` |
| `hooks/use-cloud-sync.ts` | **First call-site migration** — now calls `getRuntime().writeFiles()` instead of `syncWorkspaceFiles()` directly |
| `components/editor/terminal-pane.tsx` | Created — streams `exec()` output, accepts shell input |
| `components/editor/editor-shell.tsx` | `TerminalPane` mounted as third grid row when `flags.browserRuntime`; grid rows extended dynamically |
| `src/flags.ts` | `browserRuntime` flipped to `true` |

### Architecture
- `WebContainerRuntime.boot()` is lazy — called on first `writeFiles`/`exec`/etc, not on import
- Dynamic `import("@webcontainer/api")` keeps the package out of the SSR bundle
- `writeFiles` maps `WorkspaceFile[]` → WebContainer `FileSystemTree` and calls `wc.mount()`
- `exec` splits command string, spawns process, pipes stdout via `WritableStream`, throws on non-zero exit
- `spawnDevServer` listens for `server-ready` event, starts `npx serve`
- `snapshot`/`hydrate` walk the FS and round-trip as JSON blobs
- COOP/COEP headers (Phase 3) are the prerequisite — `crossOriginIsolated` must be true at runtime

### What was NOT changed
- `ServerRuntime` still exists and is returned when `browserRuntime = false`
- `lib/cloud-sync/client.ts` still exists (not deleted until Phase 12)
- Zero visual changes beyond the terminal pane appearing

### Acceptance criteria
- [x] `next build` passes, zero errors, zero warnings
- [x] `WebContainerRuntime` implements full `WorkspaceRuntime` interface
- [x] `use-cloud-sync.ts` routes through `getRuntime()` adapter
- [x] `TerminalPane` renders and accepts input when `flags.browserRuntime`

### Rollback
Set `browserRuntime: false`. Remove `@webcontainer/api`. Revert `use-cloud-sync.ts` to call
`syncWorkspaceFiles()` directly. Delete `terminal-pane.tsx`. Revert `runtime.ts` and `index.ts`.

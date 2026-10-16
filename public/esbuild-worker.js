/**
 * esbuild-worker.js — runs in a Web Worker context.
 *
 * Protocol (postMessage):
 *   IN:  { id: string, code: string, filename: string }
 *   OUT: { id: string, output?: string, errors?: string[] }
 *       | { type: 'ready' }
 *       | { type: 'error', message: string }
 */

/* global importScripts, esbuild */

let ready = false;

// esbuild-wasm ESM bundle exposes a global `esbuild` when loaded via importScripts.
// We use the local copy served from /public/.
importScripts('/esbuild-browser.min.js');

esbuild
  .initialize({ wasmURL: '/esbuild.wasm', worker: false })
  .then(() => {
    ready = true;
    postMessage({ type: 'ready' });
  })
  .catch((err) => {
    postMessage({ type: 'error', message: String(err) });
  });

self.onmessage = async (event) => {
  if (!ready) {
    postMessage({ id: event.data.id, errors: ['esbuild not ready yet'] });
    return;
  }

  const { id, code, filename } = event.data;

  try {
    const ext = filename.split('.').pop() ?? 'ts';
    const loader =
      ext === 'tsx' ? 'tsx'
      : ext === 'jsx' ? 'jsx'
      : ext === 'ts'  ? 'ts'
      : 'js';

    const result = await esbuild.transform(code, {
      loader,
      target: 'es2020',
      format: 'esm',
      sourcemap: false,
      treeShaking: false,
    });

    const errors = result.warnings.map((w) => w.text);
    postMessage({ id, output: result.code, errors });
  } catch (err) {
    const messages = err.errors
      ? err.errors.map((e) => `${e.text} (${e.location?.line ?? '?'}:${e.location?.column ?? '?'})`)
      : [String(err)];
    postMessage({ id, errors: messages });
  }
};

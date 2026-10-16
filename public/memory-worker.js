/**
 * memory-worker.js — runs in a dedicated Web Worker.
 *
 * Owns:
 *   - sqlite-wasm database in OPFS (persistent across sessions)
 *   - @huggingface/transformers embedding pipeline (Xenova/all-MiniLM-L6-v2)
 *
 * Protocol (postMessage):
 *   IN:  { id, op, ...args }
 *   OUT: { id, result?, error? }
 *        { type: 'ready' }
 *        { type: 'status', message }
 */

/* ── Bootstrap ───────────────────────────────────────────────────────────── */

let db = null;
let embedder = null;

async function init() {
  postStatus('Loading sqlite-wasm…');

  // sqlite-wasm ESM — loaded as a module worker via { type: 'module' } in the driver.
  // We use the OPFS VFS for persistence.
  const { default: sqlite3InitModule } = await import('/sqlite3-esm.js').catch(() => null)
    ?? await import('https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.53.4-build2/dist/index.mjs');

  // Fallback: if OPFS is unavailable (e.g. non-secure context), use in-memory.
  let sqlite3;
  try {
    sqlite3 = await sqlite3InitModule({ locateFile: () => '/sqlite3.wasm' });
  } catch {
    postMessage({ type: 'error', message: 'sqlite-wasm failed to initialise' });
    return;
  }

  const hasOpfs = 'opfs' in sqlite3;
  db = hasOpfs
    ? new sqlite3.oo1.OpfsDb('/ace-memory.db')
    : new sqlite3.oo1.DB(':memory:');

  postStatus(hasOpfs ? 'OPFS DB open' : 'In-memory DB (OPFS unavailable)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id        TEXT PRIMARY KEY,
      content   TEXT NOT NULL,
      embedding BLOB,
      metadata  TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  postStatus('Loading embedding model…');

  try {
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
    postStatus('Embedding model ready');
  } catch (err) {
    // Embedder is optional — recall falls back to keyword match
    postStatus('Embedder unavailable: ' + String(err));
  }

  postMessage({ type: 'ready' });
}

function postStatus(message) {
  postMessage({ type: 'status', message });
}

/* ── Embedding helpers ───────────────────────────────────────────────────── */

async function embed(text) {
  if (!embedder) return null;
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function encodeEmbedding(arr) {
  if (!arr) return null;
  const buf = new Float32Array(arr);
  return buf.buffer;
}

function decodeEmbedding(blob) {
  if (!blob) return null;
  const arr = new Float32Array(blob);
  return Array.from(arr);
}

/* ── Operations ──────────────────────────────────────────────────────────── */

async function opRemember({ content, metadata }) {
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const embedding = await embed(content);
  const embBlob   = encodeEmbedding(embedding);
  const metaJson  = metadata ? JSON.stringify(metadata) : null;

  db.exec({
    sql: `INSERT INTO memories (id, content, embedding, metadata, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    bind: [id, content, embBlob, metaJson, Date.now()],
  });

  return { id, content, embedding: embedding ?? undefined, metadata, createdAt: Date.now() };
}

async function opRecall({ query, topK = 5, minScore = 0.3 }) {
  const queryEmb = await embed(query);

  const rows = [];
  db.exec({
    sql: `SELECT id, content, embedding, metadata, created_at FROM memories`,
    rowMode: 'object',
    callback: (row) => rows.push(row),
  });

  if (!queryEmb || rows.length === 0) {
    // Keyword fallback
    const q = query.toLowerCase();
    return rows
      .filter((r) => r.content.toLowerCase().includes(q))
      .slice(0, topK)
      .map(rowToEntry);
  }

  return rows
    .map((row) => {
      const emb   = decodeEmbedding(row.embedding);
      const score = emb ? cosine(queryEmb, emb) : 0;
      return { row, score };
    })
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ row }) => rowToEntry(row));
}

function rowToEntry(row) {
  return {
    id:        row.id,
    content:   row.content,
    metadata:  row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  };
}

async function opConsolidate() {
  // Re-embed any rows missing embeddings (e.g. added before embedder was ready)
  const rows = [];
  db.exec({
    sql: `SELECT id, content FROM memories WHERE embedding IS NULL`,
    rowMode: 'object',
    callback: (row) => rows.push(row),
  });

  for (const row of rows) {
    const emb = await embed(row.content);
    if (!emb) continue;
    db.exec({
      sql: `UPDATE memories SET embedding = ? WHERE id = ?`,
      bind: [encodeEmbedding(emb), row.id],
    });
  }
}

async function opExport() {
  const rows = [];
  db.exec({
    sql: `SELECT id, content, metadata, created_at FROM memories ORDER BY created_at`,
    rowMode: 'object',
    callback: (row) => rows.push(rowToEntry(row)),
  });
  return JSON.stringify(rows);
}

async function opImport({ json }) {
  const entries = JSON.parse(json);
  for (const entry of entries) {
    const existing = db.selectValue(`SELECT id FROM memories WHERE id = ?`, [entry.id]);
    if (existing) continue;
    const emb = await embed(entry.content);
    db.exec({
      sql: `INSERT INTO memories (id, content, embedding, metadata, created_at) VALUES (?,?,?,?,?)`,
      bind: [entry.id, entry.content, encodeEmbedding(emb), entry.metadata ? JSON.stringify(entry.metadata) : null, entry.createdAt],
    });
  }
}

/* ── Message router ──────────────────────────────────────────────────────── */

const OPS = { remember: opRemember, recall: opRecall, consolidate: opConsolidate, export: opExport, import: opImport };

self.onmessage = async (event) => {
  const { id, op, ...args } = event.data;
  try {
    const fn = OPS[op];
    if (!fn) throw new Error(`Unknown op: ${op}`);
    const result = await fn(args);
    postMessage({ id, result });
  } catch (err) {
    postMessage({ id, error: String(err) });
  }
};

init().catch((err) => postMessage({ type: 'error', message: String(err) }));

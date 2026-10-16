import { countTokens } from "../../lib/tokens";
import type { ChunkKind, ChunkMetadata } from "../../types/domain";

/**
 * Smart code chunker.
 *
 * Fixed-width character slicing destroys structure: it splits mid-function,
 * loses the enclosing symbol, and starves the retriever of import context.
 * Instead we:
 *   1. carve the source into *structural segments* by language family
 *      (brace-delimited, indent-delimited, or generic);
 *   2. detect the defining symbol + kind for each segment;
 *   3. pack segments into token-budgeted chunks, adding a tail overlap so a
 *      definition that straddles a boundary stays retrievable from both sides.
 *
 * The output is pure data (no ids) — persistence assigns ids and embeddings.
 */

export interface ChunkDraft {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  startLine: number;
  endLine: number;
  symbol: string | null;
  kind: ChunkKind;
  metadata: ChunkMetadata;
}

export interface ChunkerOptions {
  language: string;
  filePath?: string;
  maxTokens: number;
  overlapTokens: number;
  /** Content hash of the file, echoed into chunk metadata for cache busting. */
  contentHash?: string;
}

type LanguageFamily = "brace" | "indent" | "generic";

interface LanguageProfile {
  family: LanguageFamily;
}

const PROFILES: Record<string, LanguageFamily> = {
  typescript: "brace",
  javascript: "brace",
  tsx: "brace",
  jsx: "brace",
  java: "brace",
  c: "brace",
  cpp: "brace",
  csharp: "brace",
  go: "brace",
  rust: "brace",
  swift: "brace",
  kotlin: "brace",
  php: "brace",
  css: "brace",
  scss: "brace",
  json: "brace",
  python: "indent",
  yaml: "indent",
  ruby: "indent",
};

function familyFor(language: string): LanguageFamily {
  return PROFILES[language.toLowerCase()] ?? "generic";
}

interface Segment {
  startLine: number;
  endLine: number;
  text: string;
  kind: ChunkKind;
  symbol: string | null;
}

const IMPORT_RE =
  /^\s*(import\b|from\b|require\(|#include\b|use\b|package\b|const\s+\w+\s*=\s*require)/;

const DEFINE_RES: Array<{ re: RegExp; kind: ChunkKind; group: number }> = [
  { re: /^\s*(export\s+)?(default\s+)?(abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: "class", group: 4 },
  { re: /^\s*(export\s+)?(async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, kind: "function", group: 3 },
  { re: /^\s*(export\s+)?(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?\(?[\w\s,:$]*\)?\s*=>/, kind: "function", group: 3 },
  { re: /^\s*(def|func|fn)\s+([A-Za-z_$][\w$]*)/, kind: "function", group: 2 },
  { re: /^\s*interface\s+([A-Za-z_$][\w$]*)/, kind: "class", group: 1 },
  { re: /^\s*(type|enum)\s+([A-Za-z_$][\w$]*)/, kind: "class", group: 2 },
];

function detectDefinition(line: string): { kind: ChunkKind; symbol: string | null } {
  if (IMPORT_RE.test(line)) return { kind: "import", symbol: null };
  const trimmed = line.trimStart();
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*")
  ) {
    return { kind: "comment", symbol: null };
  }
  for (const { re, kind, group } of DEFINE_RES) {
    const match = line.match(re);
    if (match) return { kind, symbol: match[group] ?? null };
  }
  return { kind: "block", symbol: null };
}

function extractImports(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split("\n")) {
    if (!IMPORT_RE.test(line)) continue;
    const quoted = line.match(/["']([^"']+)["']/);
    if (quoted && quoted[1]) out.add(quoted[1]);
  }
  return [...out];
}

function firstMeaningful(lines: string[]): string {
  return lines.find((l) => l.trim().length > 0) ?? "";
}

/** Split brace-delimited source into top-level structural segments. */
function segmentBrace(lines: string[]): Segment[] {
  const segments: Segment[] = [];
  let depth = 0;
  let start = -1;
  let buffer: string[] = [];
  let inBlockComment = false;

  const flush = (endLine: number) => {
    if (start < 0) return;
    const text = buffer.join("\n");
    if (text.trim().length > 0) {
      const { kind, symbol } = detectDefinition(firstMeaningful(buffer));
      segments.push({ startLine: start, endLine, text, kind, symbol });
    }
    start = -1;
    buffer = [];
  };

  for (const [i, line] of lines.entries()) {
    const lineNo = i + 1;
    if (start < 0 && line.trim().length > 0) start = lineNo;
    if (start >= 0) buffer.push(line);

    for (let c = 0; c < line.length; c++) {
      if (inBlockComment) {
        if (line[c] === "*" && line[c + 1] === "/") {
          inBlockComment = false;
          c++;
        }
        continue;
      }
      if (line[c] === "/" && line[c + 1] === "*") {
        inBlockComment = true;
        c++;
        continue;
      }
      if (line[c] === "/" && line[c + 1] === "/") break;
      if (line[c] === "{") depth++;
      else if (line[c] === "}") depth--;
    }

    if (depth <= 0 && start >= 0) {
      flush(lineNo);
      depth = 0;
    }
  }
  flush(lines.length);
  return segments;
}

/** Split indent-delimited source (Python/YAML) at dedents to column 0. */
function segmentIndent(lines: string[]): Segment[] {
  const segments: Segment[] = [];
  let start = -1;
  let buffer: string[] = [];

  const flush = (endLine: number) => {
    if (start < 0) return;
    const text = buffer.join("\n");
    if (text.trim().length > 0) {
      const { kind, symbol } = detectDefinition(firstMeaningful(buffer));
      segments.push({ startLine: start, endLine, text, kind, symbol });
    }
    start = -1;
    buffer = [];
  };

  for (const [i, line] of lines.entries()) {
    const isTopLevel = line.trim().length > 0 && !/^\s/.test(line);
    if (isTopLevel && buffer.length > 0 && !line.trimStart().startsWith("#")) {
      flush(i); // the new column-0 statement ends the prior block
    }
    if (start < 0 && line.trim().length > 0) start = i + 1;
    if (start >= 0) buffer.push(line);
  }
  flush(lines.length);
  return segments;
}

/** Fallback: split on blank lines, then merge tiny fragments later. */
function segmentGeneric(lines: string[]): Segment[] {
  const segments: Segment[] = [];
  let start = -1;
  let buffer: string[] = [];

  const flush = (endLine: number) => {
    if (start < 0) return;
    const text = buffer.join("\n");
    if (text.trim().length > 0) {
      const { kind, symbol } = detectDefinition(firstMeaningful(buffer));
      segments.push({ startLine: start, endLine, text, kind, symbol });
    }
    start = -1;
    buffer = [];
  };

  for (const [i, line] of lines.entries()) {
    if (line.trim().length === 0 && buffer.length > 0) {
      flush(i);
      continue;
    }
    if (start < 0 && line.trim().length > 0) start = i + 1;
    if (start >= 0) buffer.push(line);
  }
  flush(lines.length);
  return segments;
}

function segmentSource(source: string, family: LanguageFamily): Segment[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  switch (family) {
    case "brace":
      return segmentBrace(lines);
    case "indent":
      return segmentIndent(lines);
    default:
      return segmentGeneric(lines);
  }
}

/** Greedy pack segments into chunk-sized windows with a trailing overlap. */
function packSegments(segments: Segment[], options: ChunkerOptions): ChunkDraft[] {
  const { maxTokens, overlapTokens, language, filePath, contentHash } = options;
  const drafts: ChunkDraft[] = [];
  let index = 0;
  let i = 0;

  while (i < segments.length) {
    const group: Segment[] = [];
    let tokens = 0;
    let j = i;

    // Fold consecutive imports together so a lone import never becomes its own
    // chunk; otherwise respect the token budget.
    while (j < segments.length) {
      const seg = segments[j];
      if (!seg) break;
      // A definition always begins a fresh chunk: merging it with neighbours
      // would make the chunk's `symbol`/`kind` misrepresent its contents and
      // pollute vector search. Imports/headers/blocks still fold together.
      if (group.length > 0 && (seg.kind === "function" || seg.kind === "class")) break;
      const segTokens = countTokens(seg.text) + 1;
      const isImportRun = seg.kind === "import" && group.every((g) => g.kind === "import");
      const canFold = group.length === 0 || tokens + segTokens <= maxTokens || isImportRun;
      if (!canFold) break;
      group.push(seg);
      tokens += segTokens;
      j++;
    }

    if (group.length === 0) {
      const fallback = segments[j];
      if (!fallback) break;
      group.push(fallback);
      j++;
    }

    const first = group[0]!;
    const last = group[group.length - 1]!;
    const symbol = group.find((g) => g.symbol)?.symbol ?? first.symbol ?? null;
    const kind =
      group.find((g) => g.kind !== "block" && g.kind !== "import")?.kind ??
      (group.every((g) => g.kind === "import") ? "import" : first.kind);

    const content = group.map((g) => g.text).join("\n\n");

    drafts.push({
      chunkIndex: index++,
      content,
      tokenCount: countTokens(content),
      startLine: first.startLine,
      endLine: last.endLine,
      symbol,
      kind,
      metadata: {
        language,
        filePath,
        contentHash,
        imports: extractImports(content),
        defines: symbol ? [symbol] : [],
      },
    });

    // Advance with overlap: step back over trailing segments until the overlap
    // budget is met, so boundary definitions remain retrievable.
    let back = j;
    if (overlapTokens > 0) {
      let overlap = 0;
      let k = j - 1;
      while (k > i && overlap < overlapTokens) {
        const seg = segments[k];
        if (!seg) break;
        overlap += countTokens(seg.text) + 1;
        k--;
      }
      back = Math.max(k + 1, i + 1);
    }
    i = back;
  }

  return drafts;
}

/**
 * Entry point. Returns retrieval-ready chunks for a file's source text.
 */
export function chunkCode(source: string, options: ChunkerOptions): ChunkDraft[] {
  if (!source.trim()) return [];
  const segments = segmentSource(source, familyFor(options.language));
  if (segments.length === 0) return [];
  return packSegments(segments, options);
}

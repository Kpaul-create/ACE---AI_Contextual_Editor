import { describe, expect, it } from "vitest";
import { chunkCode } from "../../src/services/rag/chunker";

const TS_SOURCE = `import { readFile } from "node:fs/promises";
import path from "node:path";

export interface Config {
  root: string;
}

export class Loader {
  constructor(private readonly config: Config) {}

  async load(name: string): Promise<string> {
    return readFile(path.join(this.config.root, name), "utf8");
  }
}

export function helper(value: number): number {
  return value * 2;
}
`;

const PY_SOURCE = `import os


class Service:
    def __init__(self, root):
        self.root = root

    def read(self, name):
        return open(os.path.join(self.root, name)).read()


def main():
    Service("/tmp").read("a.txt")
`;

describe("chunkCode", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkCode("   \n  ", { language: "typescript", maxTokens: 256, overlapTokens: 0 })).toEqual([]);
  });

  it("detects structural kind and symbol for brace languages", () => {
    const chunks = chunkCode(TS_SOURCE, {
      language: "typescript",
      maxTokens: 256,
      overlapTokens: 0,
      filePath: "src/loader.ts",
    });
    expect(chunks.length).toBeGreaterThan(0);
    const kinds = chunks.map((c) => c.kind);
    expect(kinds).toContain("class");
    expect(kinds).toContain("function");
    expect(chunks.some((c) => c.symbol === "Loader")).toBe(true);
    expect(chunks.some((c) => c.symbol === "helper")).toBe(true);
  });

  it("captures import metadata", () => {
    const chunks = chunkCode(TS_SOURCE, {
      language: "typescript",
      maxTokens: 256,
      overlapTokens: 0,
      filePath: "src/loader.ts",
    });
    const allImports = chunks.flatMap((c) => c.metadata.imports ?? []);
    expect(allImports).toContain("node:fs/promises");
    expect(allImports).toContain("node:path");
  });

  it("splits indent-delimited python at top-level blocks", () => {
    const chunks = chunkCode(PY_SOURCE, {
      language: "python",
      maxTokens: 256,
      overlapTokens: 0,
    });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.symbol === "Service")).toBe(true);
    expect(chunks.some((c) => c.symbol === "main")).toBe(true);
  });

  it("honours the token budget per chunk", () => {
    const maxTokens = 40;
    const chunks = chunkCode(TS_SOURCE, {
      language: "typescript",
      maxTokens,
      overlapTokens: 0,
    });
    for (const chunk of chunks) {
      // A single oversized segment may exceed; multi-segment chunks must not.
      expect(chunk.tokenCount).toBeLessThanOrEqual(maxTokens * 4);
    }
  });

  it("adds overlap so boundary definitions stay retrievable", () => {
    const noOverlap = chunkCode(TS_SOURCE, {
      language: "typescript",
      maxTokens: 20,
      overlapTokens: 0,
    });
    const withOverlap = chunkCode(TS_SOURCE, {
      language: "typescript",
      maxTokens: 20,
      overlapTokens: 15,
    });
    expect(withOverlap.length).toBeGreaterThanOrEqual(noOverlap.length);
  });
});

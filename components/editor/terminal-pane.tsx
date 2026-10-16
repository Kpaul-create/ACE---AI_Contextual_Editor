"use client";

import { useRef, useState } from "react";
import { getRuntime } from "@/src/adapters";
import { useFileTreeStore } from "@/stores/file-tree-store";

interface Line {
  id: number;
  text: string;
  type: "cmd" | "out" | "err";
}

let lineId = 0;

export function TerminalPane() {
  const [lines, setLines]   = useState<Line[]>([{ id: lineId++, text: "WebContainer ready. Type a command.", type: "out" }]);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const bottomRef           = useRef<HTMLDivElement>(null);
  const files               = useFileTreeStore((s) => s.files);

  function push(text: string, type: Line["type"]) {
    setLines((prev) => [...prev, { id: lineId++, text, type }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  async function run() {
    const cmd = input.trim();
    if (!cmd || busy) return;
    setInput("");
    push(`$ ${cmd}`, "cmd");
    setBusy(true);
    try {
      // Mount latest files before every command so the FS is up to date
      await getRuntime().writeFiles("default", files);
      const out = await getRuntime().exec(cmd);
      if (out) push(out, "out");
    } catch (err) {
      push(err instanceof Error ? err.message : String(err), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-black/40 font-mono text-[11px]">
      {/* output */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2 leading-5">
        {lines.map((l) => (
          <div
            key={l.id}
            className={
              l.type === "cmd" ? "text-accent/80"
              : l.type === "err" ? "text-red-400/80"
              : "text-white/55"
            }
          >
            <pre className="whitespace-pre-wrap break-all">{l.text}</pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="flex shrink-0 items-center gap-1.5 border-t border-[var(--surface-border)] px-2 py-1.5">
        <span className="text-accent/60">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
          disabled={busy}
          placeholder={busy ? "running…" : "command"}
          className="flex-1 bg-transparent text-white/70 placeholder:text-white/20 outline-none"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}

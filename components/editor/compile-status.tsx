"use client";

import { useEffect, useRef, useState } from "react";
import { getCompiler } from "@/src/adapters";
import { useFileTreeStore } from "@/stores/file-tree-store";

type State = "idle" | "compiling" | "ok" | "error";

const COMPILABLE = new Set(["ts", "tsx", "js", "jsx"]);

function extOf(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Compiles the active file whenever its content changes.
 * Renders a small status chip — only mounted when flags.compilePipeline is true.
 */
export function CompileStatus() {
  const files       = useFileTreeStore((s) => s.files);
  const activeId    = useFileTreeStore((s) => s.activeFileId);
  const activeFile  = files.find((f) => f.id === activeId);

  const [state, setState]   = useState<State>("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const debounceRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef          = useRef<string>("");

  useEffect(() => {
    if (!activeFile) return;
    if (!COMPILABLE.has(extOf(activeFile.path))) {
      setState("idle");
      setErrors([]);
      return;
    }
    // Skip if content unchanged
    if (activeFile.content === contentRef.current) return;
    contentRef.current = activeFile.content;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setState("compiling");
      const result = await getCompiler().compile(activeFile.content, activeFile.name);
      setState(result.ok ? "ok" : "error");
      setErrors(result.errors);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeFile]);

  if (state === "idle") return null;

  const label =
    state === "compiling" ? "compiling…"
    : state === "ok"      ? "✓ compiled"
    : `✗ ${errors.length} error${errors.length !== 1 ? "s" : ""}`;

  const colour =
    state === "compiling" ? "text-white/35"
    : state === "ok"      ? "text-green-400/80"
    : "text-red-400/80";

  return (
    <span
      className={`shrink-0 px-2 font-mono text-[9px] transition-colors ${colour}`}
      title={errors.join("\n") || undefined}
    >
      {label}
    </span>
  );
}

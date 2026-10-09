"use client";

import { ChevronDown, ChevronRight, FileCode2, FileText, Folder } from "lucide-react";
import { useFileTreeStore } from "@/stores/file-tree-store";
import { cn } from "@/lib/utils";

export function FileExplorer() {
  const files = useFileTreeStore((state) => state.files);
  const activeFileId = useFileTreeStore((state) => state.activeFileId);
  const expandedPaths = useFileTreeStore((state) => state.expandedPaths);
  const setActiveFile = useFileTreeStore((state) => state.setActiveFile);
  const togglePath = useFileTreeStore((state) => state.togglePath);
  const sourceFiles = files.filter((file) => file.path.startsWith("src/"));
  const rootFiles = files.filter((file) => !file.path.includes("/"));
  const sourceExpanded = expandedPaths.includes("src");

  return (
    <nav aria-label="Project files" className="space-y-1">
      <button
        type="button"
        onClick={() => togglePath("src")}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted hover:bg-white/[0.04] hover:text-foreground"
      >
        {sourceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={14} />
        <span>src</span>
      </button>
      {sourceExpanded &&
        sourceFiles.map((file) => (
          <FileRow
            key={file.id}
            name={file.name}
            active={file.id === activeFileId}
            onClick={() => setActiveFile(file.id)}
            indent
          />
        ))}
      {rootFiles.map((file) => (
        <FileRow
          key={file.id}
          name={file.name}
          active={file.id === activeFileId}
          onClick={() => setActiveFile(file.id)}
        />
      ))}
    </nav>
  );
}

function FileRow({
  name,
  active,
  indent = false,
  onClick,
}: {
  name: string;
  active: boolean;
  indent?: boolean;
  onClick: () => void;
}) {
  const Icon = name.endsWith(".md") ? FileText : FileCode2;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
        indent && "pl-7",
        active
          ? "bg-accent/10 text-accent"
          : "text-muted hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      <Icon size={14} />
      <span>{name}</span>
    </button>
  );
}

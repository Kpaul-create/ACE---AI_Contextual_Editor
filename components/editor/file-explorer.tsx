"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronRight,
  FileCode2, FileText, FileJson, FileCog,
  Folder, FolderOpen,
  Plus, Trash2, Pencil,
} from "lucide-react";
import { useFileTreeStore } from "@/stores/file-tree-store";
import type { WorkspaceFile } from "@/types/workspace";
import { cn } from "@/lib/utils";

/* ── file icon by extension ─────────────────────────────────────────────── */
function FileIcon({ name, size = 13 }: { name: string; size?: number }) {
  const ext = name.split(".").pop() ?? "";
  if (["md", "txt", "rst"].includes(ext))
    return <FileText size={size} className="text-blue-300/70" />;
  if (["json", "yaml", "yml", "toml"].includes(ext))
    return <FileJson size={size} className="text-yellow-300/70" />;
  if (["css", "scss", "sass", "less"].includes(ext))
    return <FileCog size={size} className="text-pink-300/70" />;
  if (["html", "htm"].includes(ext))
    return <FileCode2 size={size} className="text-orange-300/70" />;
  if (["js", "jsx", "mjs"].includes(ext))
    return <FileCode2 size={size} className="text-yellow-200/70" />;
  if (["ts", "tsx"].includes(ext))
    return <FileCode2 size={size} className="text-blue-400/70" />;
  if (["py"].includes(ext))
    return <FileCode2 size={size} className="text-green-300/70" />;
  return <FileCode2 size={size} className="text-white/40" />;
}

/* ── build folder tree from flat file list ──────────────────────────────── */
interface TreeNode {
  type: "file";
  file: WorkspaceFile;
}
interface FolderNode {
  type: "folder";
  name: string;
  path: string;
  children: (TreeNode | FolderNode)[];
}
type Node = TreeNode | FolderNode;

function buildTree(files: WorkspaceFile[]): (TreeNode | FolderNode)[] {
  const root: (TreeNode | FolderNode)[] = [];
  const folders = new Map<string, FolderNode>();

  function getFolder(folderPath: string): FolderNode {
    if (folders.has(folderPath)) return folders.get(folderPath)!;
    const parts = folderPath.split("/");
    const name = parts[parts.length - 1];
    const node: FolderNode = { type: "folder", name, path: folderPath, children: [] };
    folders.set(folderPath, node);

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      getFolder(parentPath).children.push(node);
    }
    return node;
  }

  // Sort: folders first, then files, both alphabetically
  const sorted = [...files].sort((a, b) => {
    const aDepth = a.path.split("/").length;
    const bDepth = b.path.split("/").length;
    if (aDepth !== bDepth) return bDepth - aDepth;
    return a.path.localeCompare(b.path);
  });

  for (const file of sorted) {
    const parts = file.path.split("/");
    if (parts.length === 1) {
      root.push({ type: "file", file });
    } else {
      const folderPath = parts.slice(0, -1).join("/");
      getFolder(folderPath).children.push({ type: "file", file });
    }
  }

  // Sort each folder's children: folders first
  function sortChildren(nodes: Node[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      const aName = a.type === "folder" ? a.name : a.file.name;
      const bName = b.type === "folder" ? b.name : b.file.name;
      return aName.localeCompare(bName);
    });
    for (const n of nodes) {
      if (n.type === "folder") sortChildren(n.children);
    }
  }
  sortChildren(root);
  return root;
}

/* ── inline rename input ────────────────────────────────────────────────── */
function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initial);
  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onCommit(val)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(val);
        if (e.key === "Escape") onCancel();
      }}
      className="w-full rounded bg-white/10 px-1 font-mono text-[11px] text-white/80 outline-none ring-1 ring-accent/50"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/* ── single file row ────────────────────────────────────────────────────── */
function FileRow({
  file,
  active,
  depth,
  onSelect,
}: {
  file: WorkspaceFile;
  active: boolean;
  depth: number;
  onSelect: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const renameFile = useFileTreeStore((s) => s.renameFile);
  const deleteFile = useFileTreeStore((s) => s.deleteFile);

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded py-[3px] pr-1 text-[11px] transition-colors cursor-pointer",
        active ? "bg-white/[0.10] text-white/90" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80",
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <FileIcon name={file.name} />
      {renaming ? (
        <RenameInput
          initial={file.name}
          onCommit={(v) => { if (v.trim()) renameFile(file.id, v.trim()); setRenaming(false); }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate font-mono">{file.name}</span>
      )}
      {hovered && !renaming && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
            className="rounded p-0.5 hover:text-white/90"
            aria-label="Rename"
          >
            <Pencil size={9} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
            className="rounded p-0.5 hover:text-red-400"
            aria-label="Delete"
          >
            <Trash2 size={9} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── folder row ─────────────────────────────────────────────────────────── */
function FolderRow({
  node,
  depth,
  activeFileId,
}: {
  node: FolderNode;
  depth: number;
  activeFileId: string;
}) {
  const expandedPaths = useFileTreeStore((s) => s.expandedPaths);
  const togglePath    = useFileTreeStore((s) => s.togglePath);
  const setActiveFile = useFileTreeStore((s) => s.setActiveFile);
  const createFile    = useFileTreeStore((s) => s.createFile);
  const [hovered, setHovered] = useState(false);
  const expanded = expandedPaths.includes(node.path);

  function handleNewFile(e: React.MouseEvent) {
    e.stopPropagation();
    const name = prompt("File name:");
    if (name?.trim()) {
      createFile(`${node.path}/${name.trim()}`);
    }
  }

  return (
    <>
      <div
        className="group flex items-center gap-1.5 rounded py-[3px] pr-1 text-[11px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white/85 cursor-pointer"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => togglePath(node.path)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="shrink-0 text-white/30">
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        {expanded
          ? <FolderOpen size={13} className="shrink-0 text-yellow-300/60" />
          : <Folder size={13} className="shrink-0 text-yellow-300/60" />
        }
        <span className="min-w-0 flex-1 truncate font-mono">{node.name}</span>
        {hovered && (
          <button
            type="button"
            onClick={handleNewFile}
            className="shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:text-white/90"
            aria-label="New file"
          >
            <Plus size={9} />
          </button>
        )}
      </div>
      {expanded && node.children.map((child) =>
        child.type === "folder" ? (
          <FolderRow key={child.path} node={child} depth={depth + 1} activeFileId={activeFileId} />
        ) : (
          <FileRow
            key={child.file.id}
            file={child.file}
            active={child.file.id === activeFileId}
            depth={depth + 1}
            onSelect={() => setActiveFile(child.file.id)}
          />
        )
      )}
    </>
  );
}

/* ── root explorer ──────────────────────────────────────────────────────── */
export function FileExplorer() {
  const files       = useFileTreeStore((s) => s.files);
  const activeFileId = useFileTreeStore((s) => s.activeFileId);
  const setActiveFile = useFileTreeStore((s) => s.setActiveFile);
  const createFile  = useFileTreeStore((s) => s.createFile);

  const tree = buildTree(files);

  function handleNewRootFile() {
    const name = prompt("File name:");
    if (name?.trim()) createFile(name.trim());
  }

  return (
    <nav aria-label="Project files" className="select-none">
      {/* workspace header row */}
      <div className="mb-0.5 flex items-center justify-between px-2 py-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">
          project
        </span>
        <button
          type="button"
          onClick={handleNewRootFile}
          className="rounded p-0.5 text-white/25 hover:text-white/70"
          aria-label="New file"
        >
          <Plus size={11} />
        </button>
      </div>

      {tree.map((node) =>
        node.type === "folder" ? (
          <FolderRow key={node.path} node={node} depth={0} activeFileId={activeFileId} />
        ) : (
          <FileRow
            key={node.file.id}
            file={node.file}
            active={node.file.id === activeFileId}
            depth={0}
            onSelect={() => setActiveFile(node.file.id)}
          />
        )
      )}
    </nav>
  );
}

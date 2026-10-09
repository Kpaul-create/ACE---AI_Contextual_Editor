import { create } from "zustand";
import type { WorkspaceFile } from "@/types/workspace";

const initialFiles: WorkspaceFile[] = [
  {
    id: "readme",
    name: "README.md",
    path: "README.md",
    language: "markdown",
    content: "# Welcome\n\nSelect a file and start writing.",
  },
  {
    id: "index",
    name: "index.ts",
    path: "src/index.ts",
    language: "typescript",
    content: "export function greet(name: string) {\n  return `Hello, ${name}`;\n}\n",
  },
];

type FileTreeState = {
  files: WorkspaceFile[];
  activeFileId: string;
  expandedPaths: string[];
  setActiveFile: (id: string) => void;
  setFileContent: (id: string, content: string) => void;
  togglePath: (path: string) => void;
};

export const useFileTreeStore = create<FileTreeState>((set) => ({
  files: initialFiles,
  activeFileId: "index",
  expandedPaths: ["src"],
  setActiveFile: (activeFileId) => set({ activeFileId }),
  setFileContent: (id, content) =>
    set((state) => ({
      files: state.files.map((file) =>
        file.id === id ? { ...file, content } : file,
      ),
    })),
  togglePath: (path) =>
    set((state) => ({
      expandedPaths: state.expandedPaths.includes(path)
        ? state.expandedPaths.filter((item) => item !== path)
        : [...state.expandedPaths, path],
    })),
}));

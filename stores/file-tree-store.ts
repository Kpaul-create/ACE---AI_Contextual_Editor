import { create } from "zustand";
import type { WorkspaceFile } from "@/types/workspace";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function langFromPath(path: string): string {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact",
    js: "javascript", jsx: "javascriptreact",
    py: "python", rs: "rust", go: "go",
    css: "css", scss: "scss",
    html: "html", json: "json",
    md: "markdown", sh: "shell",
    yaml: "yaml", yml: "yaml",
    toml: "toml", sql: "sql",
  };
  return map[ext] ?? "plaintext";
}

/* ── initial workspace ───────────────────────────────────────────────────── */
const INITIAL: WorkspaceFile[] = [
  {
    id: "index-html",
    name: "index.html",
    path: "index.html",
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.">
  <title>My Project</title>
  <link rel="stylesheet" href="styles/base.css">
  <link rel="stylesheet" href="styles/layout.css">
  <link rel="stylesheet" href="styles/components.css">
</head>
<body>
  <!-- Header -->
  <?php include 'components/header.html'; ?>

  <!-- Hero Section -->
  <section class="hero">
    <h1>Welcome</h1>
  </section>
</body>
</html>
`,
  },
  {
    id: "base-css",
    name: "base.css",
    path: "styles/base.css",
    language: "css",
    content: `:root {
  --primary: #2f5dff;
  --dark: #111;
  --light: #f8f9fa;
  --font: "Inter", sans-serif;
}

body {
  font-family: var(--font);
  background: var(--light);
  color: var(--dark);
  line-height: 1.6;
}

/* Layout */
.container {
  width: 90%;
  max-width: 1200px;
  margin: 0 auto;
}
`,
  },
  {
    id: "layout-css",
    name: "layout.css",
    path: "styles/layout.css",
    language: "css",
    content: `.hero {
  display: flex;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
}

.grid {
  display: grid;
  gap: 1.5rem;
}
`,
  },
  {
    id: "components-css",
    name: "components.css",
    path: "styles/components.css",
    language: "css",
    content: `.btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1.25rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--primary);
  color: #fff;
}
`,
  },
  {
    id: "app-js",
    name: "app.js",
    path: "scripts/app.js",
    language: "javascript",
    content: `import { initRouter } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
});
`,
  },
  {
    id: "menu-js",
    name: "menu.js",
    path: "scripts/menu.js",
    language: "javascript",
    content: `const menuToggle = document.querySelector(".menu-toggle");
const navList = document.querySelector(".nav-list");

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    navList.classList.toggle("open");
  });
}
`,
  },
  {
    id: "utils-js",
    name: "utils.js",
    path: "scripts/utils.js",
    language: "javascript",
    content: `export function initRouter() {
  const links = document.querySelectorAll('[data-route]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.dataset.route;
      history.pushState({}, '', route);
    });
  });
}
`,
  },
  {
    id: "header-html",
    name: "header.html",
    path: "components/header.html",
    language: "html",
    content: `<header class="site-header">
  <nav class="nav">
    <a href="/" class="logo">Brand</a>
    <button class="menu-toggle" aria-label="Toggle menu">☰</button>
    <ul class="nav-list">
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </nav>
</header>
`,
  },
  {
    id: "footer-html",
    name: "footer.html",
    path: "components/footer.html",
    language: "html",
    content: `<footer class="site-footer">
  <p>&copy; 2024 My Project. All rights reserved.</p>
</footer>
`,
  },
  {
    id: "card-html",
    name: "card.html",
    path: "components/card.html",
    language: "html",
    content: `<article class="card">
  <img src="" alt="" class="card-image">
  <div class="card-body">
    <h3 class="card-title"></h3>
    <p class="card-text"></p>
  </div>
</article>
`,
  },
];

/* ── store ───────────────────────────────────────────────────────────────── */
type FileTreeState = {
  files: WorkspaceFile[];
  activeFileId: string;
  expandedPaths: string[];

  setActiveFile: (id: string) => void;
  setFileContent: (id: string, content: string) => void;
  togglePath: (path: string) => void;
  expandPath: (path: string) => void;

  createFile: (path: string, content?: string) => string;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
};

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  files: INITIAL,
  activeFileId: "index-html",
  expandedPaths: ["styles", "scripts", "components"],

  setActiveFile: (activeFileId) => set({ activeFileId }),

  setFileContent: (id, content) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, content } : f)),
    })),

  togglePath: (path) =>
    set((s) => ({
      expandedPaths: s.expandedPaths.includes(path)
        ? s.expandedPaths.filter((p) => p !== path)
        : [...s.expandedPaths, path],
    })),

  expandPath: (path) =>
    set((s) => ({
      expandedPaths: s.expandedPaths.includes(path)
        ? s.expandedPaths
        : [...s.expandedPaths, path],
    })),

  createFile: (path, content = "") => {
    const id = uid();
    const name = path.split("/").pop() ?? path;
    const language = langFromPath(path);
    const file: WorkspaceFile = { id, name, path, language, content };
    set((s) => ({ files: [...s.files, file], activeFileId: id }));
    // Auto-expand parent folder
    const parts = path.split("/");
    if (parts.length > 1) {
      const folder = parts.slice(0, -1).join("/");
      get().expandPath(folder);
    }
    return id;
  },

  deleteFile: (id) =>
    set((s) => {
      const remaining = s.files.filter((f) => f.id !== id);
      const activeFileId =
        s.activeFileId === id
          ? (remaining[0]?.id ?? "")
          : s.activeFileId;
      return { files: remaining, activeFileId };
    }),

  renameFile: (id, newName) =>
    set((s) => ({
      files: s.files.map((f) => {
        if (f.id !== id) return f;
        const dir = f.path.includes("/")
          ? f.path.slice(0, f.path.lastIndexOf("/") + 1)
          : "";
        return {
          ...f,
          name: newName,
          path: dir + newName,
          language: langFromPath(newName),
        };
      }),
    })),
}));

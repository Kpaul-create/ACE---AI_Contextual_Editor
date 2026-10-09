export const editorLanguages = [
  { label: "TypeScript", value: "typescript" },
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
  { label: "Markdown", value: "markdown" },
] as const;

export function languageFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  const languages: Record<string, string> = {
    css: "css",
    html: "html",
    js: "javascript",
    json: "json",
    md: "markdown",
    py: "python",
    ts: "typescript",
    tsx: "typescript",
  };

  return (extension && languages[extension]) || "plaintext";
}

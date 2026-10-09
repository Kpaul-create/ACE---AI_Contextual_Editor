"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback } from "react";
import { languageFromPath } from "@/lib/editor/languages";
import { useEditorCursor } from "@/hooks/use-editor-cursor";
import { useFileTreeStore } from "@/stores/file-tree-store";

export function MonacoEditor() {
  const files = useFileTreeStore((state) => state.files);
  const activeFileId = useFileTreeStore((state) => state.activeFileId);
  const setFileContent = useFileTreeStore((state) => state.setFileContent);
  const { setCursor } = useEditorCursor();
  const activeFile = files.find((file) => file.id === activeFileId);

  const handleMount = useCallback<OnMount>(
    (editor) => {
      editor.onDidChangeCursorPosition(({ position }) => {
        setCursor(position.lineNumber, position.column);
      });
    },
    [setCursor],
  );

  if (!activeFile) return null;

  return (
    <Editor
      height="100%"
      language={languageFromPath(activeFile.path)}
      path={activeFile.path}
      value={activeFile.content}
      onChange={(value) => setFileContent(activeFile.id, value ?? "")}
      onMount={handleMount}
      theme="vs-dark"
      options={{
        automaticLayout: true,
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        minimap: { enabled: false },
        padding: { top: 24, bottom: 24 },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        wordWrap: "on",
        renderLineHighlight: "gutter",
      }}
    />
  );
}

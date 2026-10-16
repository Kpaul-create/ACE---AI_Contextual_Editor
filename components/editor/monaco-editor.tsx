"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { languageFromPath } from "@/lib/editor/languages";
import { useSetCursor } from "@/hooks/use-editor-cursor";
import { useEditorStore } from "@/stores/editor-store";
import { useFileTreeStore } from "@/stores/file-tree-store";

type Disposable = { dispose: () => void };

const MONACO_OPTIONS = {
  automaticLayout: true,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: 13,
  lineHeight: 20,
  minimap: { enabled: false },
  padding: { top: 16, bottom: 16 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  wordWrap: "on" as const,
  renderLineHighlight: "gutter" as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
  lineNumbersMinChars: 3,
  glyphMargin: false,
  folding: true,
  renderWhitespace: "none" as const,
};

interface MonacoEditorProps {
  /** When set, renders this file instead of the active file (split pane). */
  overrideFileId?: string;
}

export function MonacoEditor({ overrideFileId }: MonacoEditorProps = {}) {
  const files          = useFileTreeStore((s) => s.files);
  const activeFileId   = useFileTreeStore((s) => s.activeFileId);
  const setFileContent = useFileTreeStore((s) => s.setFileContent);
  const setCursor      = useSetCursor();

  const fileId = overrideFileId ?? activeFileId;
  const file   = files.find((f) => f.id === fileId);

  const cursorSubRef    = useRef<Disposable | null>(null);
  const lastPositionRef = useRef<{ line: number; column: number } | null>(null);

  // Only register cursor tracking on the primary (non-split) pane
  const isPrimary = !overrideFileId;

  const handleMount = useCallback<OnMount>(
    (editor) => {
      if (!isPrimary) return;

      cursorSubRef.current?.dispose();
      cursorSubRef.current = editor.onDidChangeCursorPosition(({ position }) => {
        const line   = position.lineNumber;
        const column = position.column;
        const current = useEditorStore.getState();
        if (current.line === line && current.column === column) {
          lastPositionRef.current = { line, column };
          return;
        }
        const last = lastPositionRef.current;
        if (last && last.line === line && last.column === column) return;
        lastPositionRef.current = { line, column };
        setCursor(line, column);
      });

      const initial = editor.getPosition();
      if (initial) {
        const current = useEditorStore.getState();
        lastPositionRef.current = { line: initial.lineNumber, column: initial.column };
        if (current.line !== initial.lineNumber || current.column !== initial.column) {
          setCursor(initial.lineNumber, initial.column);
        }
      }
    },
    [setCursor, isPrimary],
  );

  useEffect(
    () => () => {
      cursorSubRef.current?.dispose();
      cursorSubRef.current = null;
    },
    [],
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      setFileContent(fileId, value ?? "");
    },
    [setFileContent, fileId],
  );

  const options = useMemo(() => MONACO_OPTIONS, []);

  if (!file) return null;

  return (
    <Editor
      height="100%"
      language={languageFromPath(file.path)}
      path={file.path}
      value={file.content}
      onChange={handleChange}
      onMount={handleMount}
      theme="vs-dark"
      options={options}
    />
  );
}

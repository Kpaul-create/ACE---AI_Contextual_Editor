"use client";

import { useEditorStore } from "@/stores/editor-store";

export function useEditorCursor() {
  return useEditorStore((state) => ({
    line: state.line,
    column: state.column,
    setCursor: state.setCursor,
  }));
}

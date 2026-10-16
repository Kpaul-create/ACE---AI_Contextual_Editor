"use client";

import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/stores/editor-store";

type EditorCursor = {
  line: number;
  column: number;
  setCursor: (line: number, column: number) => void;
};

/**
 * Cursor state for display consumers (e.g. the status bar).
 *
 * `useShallow` keeps the returned object reference stable while the primitive
 * values are unchanged, preventing the getServerSnapshot caching issues in
 * Zustand v5's useSyncExternalStore.
 */
export function useEditorCursor(): EditorCursor {
  return useEditorStore(
    useShallow((state) => ({
      line: state.line,
      column: state.column,
      setCursor: state.setCursor,
    })),
  );
}

/**
 * Atomic position selector — prefer this when a component only needs the
 * numbers (no actions). Snapshot equality is by primitive identity.
 */
export function useCursorLineColumn(): { line: number; column: number } {
  return useEditorStore(
    useShallow((state) => ({ line: state.line, column: state.column })),
  );
}

/**
 * Setter-only selector. The action reference is stable in Zustand, so
 * subscribing via this avoids re-renders on cursor moves.
 */
export function useSetCursor(): (line: number, column: number) => void {
  return useEditorStore((state) => state.setCursor);
}

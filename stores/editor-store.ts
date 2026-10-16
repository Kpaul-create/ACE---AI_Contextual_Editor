import { create } from "zustand";

type EditorState = {
  line: number;
  column: number;
  setCursor: (line: number, column: number) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  line: 1,
  column: 1,
  setCursor: (line, column) =>
    set((state) => (state.line === line && state.column === column ? state : { line, column })),
}));

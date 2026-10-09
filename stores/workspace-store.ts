import { create } from "zustand";
import type { WorkspacePreferences } from "@/types/workspace";

type WorkspaceState = {
  preferences: WorkspacePreferences;
  setPreferences: (preferences: WorkspacePreferences) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  preferences: {
    name: "My workspace",
    primaryLanguage: "typescript",
    theme: "dark",
  },
  setPreferences: (preferences) => set({ preferences }),
}));

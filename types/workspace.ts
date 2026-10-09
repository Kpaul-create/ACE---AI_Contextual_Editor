export type WorkspaceFile = {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
};

export type WorkspacePreferences = {
  name: string;
  primaryLanguage: string;
  theme: "dark" | "light";
};

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

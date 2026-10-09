"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/stores/workspace-store";

const languages = [
  { label: "TypeScript", value: "typescript" },
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const preferences = useWorkspaceStore((state) => state.preferences);
  const setPreferences = useWorkspaceStore((state) => state.setPreferences);
  const [name, setName] = useState(preferences.name);
  const [language, setLanguage] = useState(preferences.primaryLanguage);

  function continueToWorkspace() {
    setPreferences({
      ...preferences,
      name: name.trim() || "My workspace",
      primaryLanguage: language,
    });
    router.push("/workspace/my-project");
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-xl flex-col justify-center px-5 py-16">
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-accent">
        A little setup
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Make this space yours.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted">
        Choose a workspace name and the language you work in most. You can change
        these later.
      </p>
      <div className="mt-10 space-y-7">
        <label className="block space-y-2">
          <span className="text-xs font-medium text-muted">Workspace name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Atlas"
          />
        </label>
        <fieldset className="space-y-3">
          <legend className="mb-3 text-xs font-medium text-muted">Primary language</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {languages.map((item) => {
              const selected = language === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLanguage(item.value)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm ${
                    selected
                      ? "border-accent/60 bg-accent/5 text-foreground"
                      : "border-line bg-panel text-muted hover:border-white/20"
                  }`}
                >
                  {item.label}
                  {selected && <Check size={14} className="text-accent" />}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Button variant="primary" onClick={continueToWorkspace}>
          Open workspace <ArrowRight size={15} />
        </Button>
      </div>
    </section>
  );
}

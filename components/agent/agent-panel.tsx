"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bot, Send, Loader2, Sparkles, Code2,
  Search, FileSearch, Wrench,
} from "lucide-react";
import { useSessionStore, selectProvider } from "@/stores/session-store";
import { useFileTreeStore } from "@/stores/file-tree-store";
import { cn } from "@/lib/utils";

/* ── agent skill definitions ─────────────────────────────────────────────── */
interface Skill {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: (ctx: string) => string;
}

const SKILLS: Skill[] = [
  {
    id: "explain",
    label: "Explain",
    icon: <Search size={11} />,
    prompt: (ctx) => `Explain this code concisely:\n\n${ctx}`,
  },
  {
    id: "refactor",
    label: "Refactor",
    icon: <Wrench size={11} />,
    prompt: (ctx) => `Refactor this code for clarity and performance:\n\n${ctx}`,
  },
  {
    id: "review",
    label: "Review",
    icon: <FileSearch size={11} />,
    prompt: (ctx) => `Review this code for bugs, security issues, and improvements:\n\n${ctx}`,
  },
  {
    id: "complete",
    label: "Complete",
    icon: <Code2 size={11} />,
    prompt: (ctx) => `Complete the following code. Return only the completion:\n\n${ctx}`,
  },
];

/* ── message types ───────────────────────────────────────────────────────── */
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  skill?: string;
  streaming?: boolean;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

/* ── message bubble ──────────────────────────────────────────────────────── */
function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20">
          <Bot size={11} className="text-accent" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-2.5 py-2 font-mono text-[11px] leading-5",
          isUser
            ? "bg-accent/15 text-white/80"
            : "bg-white/[0.06] text-white/70",
        )}
      >
        {msg.skill && (
          <span className="mb-1 block text-[9px] uppercase tracking-widest text-accent/60">
            {msg.skill}
          </span>
        )}
        <pre className="whitespace-pre-wrap break-words font-mono">{msg.content}</pre>
        {msg.streaming && (
          <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-accent/60" />
        )}
      </div>
    </div>
  );
}

/* ── main panel ──────────────────────────────────────────────────────────── */
export function AgentPanel() {
  const provider    = useSessionStore(selectProvider);
  const files       = useFileTreeStore((s) => s.files);
  const activeFileId = useFileTreeStore((s) => s.activeFileId);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "ACE agent ready. Select a skill or type a message.",
    },
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeFile = files.find((f) => f.id === activeFileId);

  const send = useCallback(async (text: string, skillId?: string) => {
    if (!text.trim() || loading) return;

    const skill = SKILLS.find((s) => s.id === skillId);
    const prompt = skill ? skill.prompt(text) : text;

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      skill: skill?.label,
    };
    const assistantId = uid();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/v1/editor/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          // Use a dummy projectId for agent chat — the backend will handle gracefully
          projectId: "00000000-0000-0000-0000-000000000000",
          language: activeFile?.language ?? "plaintext",
          prefix: prompt,
          suffix: "",
          cursor: { line: 1, column: 1 },
          provider,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Agent request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          try {
            const event = JSON.parse(raw) as { type: string; text?: string };
            if (event.type === "content" && event.text) {
              accumulated += event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: accumulated }
                    : m,
                ),
              );
            }
            if (event.type === "done") break;
          } catch { /* skip */ }
        }
      }

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m,
        ),
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const errMsg = err instanceof Error ? err.message : "Agent error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: errMsg, streaming: false }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [loading, provider, activeFile]);

  function handleSkill(skill: Skill) {
    const ctx = activeFile?.content ?? "";
    if (!ctx.trim()) {
      setInput(skill.prompt(""));
      setActiveSkill(skill.id);
      return;
    }
    void send(ctx, skill.id);
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--surface-border)] px-3 py-2">
        <Sparkles size={11} className="text-accent" />
        <span className="font-mono text-[10px] text-white/50">agent</span>
        <span className="ml-auto rounded bg-white/8 px-1.5 py-px font-mono text-[9px] text-white/30">
          {provider}
        </span>
      </div>

      {/* skill chips */}
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--surface-border)] px-2 py-1.5">
        {SKILLS.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => handleSkill(skill)}
            disabled={loading}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] transition-colors disabled:opacity-40",
              activeSkill === skill.id
                ? "bg-accent/20 text-accent"
                : "bg-white/[0.06] text-white/40 hover:bg-white/[0.10] hover:text-white/70",
            )}
          >
            {skill.icon}
            {skill.label}
          </button>
        ))}
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="shrink-0 border-t border-[var(--surface-border)] p-2">
        <div className="flex items-end gap-2 rounded-lg border border-[var(--surface-border)] bg-black/20 px-2.5 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask the agent…"
            rows={2}
            className="min-h-0 flex-1 resize-none bg-transparent font-mono text-[11px] text-white/70 placeholder:text-white/20 outline-none"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded p-1 text-accent/60 hover:text-accent disabled:opacity-30"
            aria-label="Send"
          >
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />
            }
          </button>
        </div>
        <p className="mt-1 px-1 font-mono text-[9px] text-white/15">
          ↵ send · shift+↵ newline · skills apply to active file
        </p>
      </div>
    </div>
  );
}

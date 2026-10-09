"use client";

import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Play, Sparkles, CheckCircle2, RefreshCw } from "lucide-react";

type NodeStatus = "idle" | "running" | "completed";

interface AgentStatusState {
  analyze_context: NodeStatus;
  generate_draft: NodeStatus;
  review_critique: NodeStatus;
  revise_content: NodeStatus;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const renderEditorHtml = (value: string) => {
  const cleaned = (value || "").replace(/\r\n/g, "\n").trim();
  if (!cleaned) return "<p></p>";

  return cleaned
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
};

export default function ContextualEditor() {
  const [instruction, setInstruction] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<{ node: string; text: string }[]>([]);
  const [nodeStatus, setNodeStatus] = useState<AgentStatusState>({
    analyze_context: "idle",
    generate_draft: "idle",
    review_critique: "idle",
    revise_content: "idle",
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Type or paste your content here to let the agentic pipeline critique and edit it live...</p>",
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[420px] p-4 text-slate-800",
      },
    },
  });

  const runPipeline = async () => {
    if (!editor || !instruction.trim() || isRunning) return;

    setIsRunning(true);
    setAgentLogs([]);
    setNodeStatus({
      analyze_context: "running",
      generate_draft: "idle",
      review_critique: "idle",
      revise_content: "idle",
    });

    try {
      const response = await fetch("http://localhost:8000/api/edit-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editor.getText(),
          instruction,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed with status ${response.status}`);
      }

      if (!response.body) throw new Error("No response body received");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.replace("data: ", "").trim();
          if (dataStr === "[DONE]") break;

          try {
            const data = JSON.parse(dataStr);
            const { node, payload } = data;

            setNodeStatus((prev) => {
              const updated = { ...prev };
              (Object.keys(updated) as Array<keyof AgentStatusState>).forEach((k) => {
                if (updated[k] === "running") updated[k] = "completed";
              });
              updated[node as keyof AgentStatusState] = "running";
              return updated;
            });

            // Update logs and editor content
            if (node === "analyze_context") {
              setAgentLogs((prev) => [...prev, { node: "Context Analyzer", text: payload.context_notes || "No context notes generated." }]);
            } else if (node === "generate_draft") {
              setAgentLogs((prev) => [...prev, { node: "Draft Generator", text: "New draft generated." }]);
              editor.commands.setContent(renderEditorHtml(payload.draft || ""));
            } else if (node === "review_critique") {
              setAgentLogs((prev) => [...prev, { node: "Quality Critic", text: payload.critique || "No critique generated." }]);
            } else if (node === "revise_content") {
              setAgentLogs((prev) => [...prev, { node: "Context Reviser", text: `Iteration ${payload.revision_count ?? 0} applied.` }]);
              editor.commands.setContent(renderEditorHtml(payload.final_output || payload.draft || ""));
            }
          } catch (e) {
            console.error("Malformed SSE chunk:", e);
          }
        }
      }
    } catch (err) {
      console.error("Pipeline failure:", err);
    } finally {
      setIsRunning(false);
      setNodeStatus({
        analyze_context: "completed",
        generate_draft: "completed",
        review_critique: "completed",
        revise_content: "completed",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h1 className="font-semibold text-lg">Contextual Agent Editor</h1>
        </div>
        <button
          onClick={runPipeline}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-md font-medium text-sm transition"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run 4-Node Pipeline
        </button>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col border-r border-slate-800 bg-white">
          <div className="border-b border-slate-200 px-4 py-2 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Workspace</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
          <div className="border-t border-slate-200 p-3 bg-slate-50">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Make it persuasive, concise, and remove passive voice..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && runPipeline()}
            />
          </div>
        </div>

        {/* Multi-Agent Orchestrator Inspector */}
        <div className="w-96 flex flex-col bg-slate-900 overflow-y-auto">
          <div className="p-4 border-b border-slate-800 font-medium text-sm text-slate-300 flex items-center gap-2">
            <span>Agent Graph Status</span>
          </div>

          {/* Node Grid */}
          <div className="p-4 space-y-2 border-b border-slate-800">
            {(
              [
                ["analyze_context", "1. Context Analyzer"],
                ["generate_draft", "2. Content Generator"],
                ["review_critique", "3. Quality Critic"],
                ["revise_content", "4. Context Reviser"],
              ] as const
            ).map(([key, label]) => {
              const status = nodeStatus[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 rounded bg-slate-800/60 border border-slate-700/50 text-xs"
                >
                  <span className="font-mono text-slate-300">{label}</span>
                  {status === "running" && <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
                  {status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {status === "idle" && <div className="w-2 h-2 rounded-full bg-slate-600" />}
                </div>
              );
            })}
          </div>

          {/* Live Node Feed */}
          <div className="flex-1 p-4 space-y-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Execution Stream</span>
            {agentLogs.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No agent execution active.</p>
            ) : (
              agentLogs.map((log, idx) => (
                <div key={idx} className="bg-slate-800/40 border border-slate-800 p-3 rounded text-xs space-y-1">
                  <div className="font-mono text-indigo-400 font-semibold">{log.node}</div>
                  <div className="text-slate-300 whitespace-pre-wrap">{log.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
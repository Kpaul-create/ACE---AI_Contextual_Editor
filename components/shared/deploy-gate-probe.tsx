"use client";

import { useEffect, useState } from "react";
import { runDeployGateProbe, type ProbeResult } from "@/src/adapters/deploy-gate";

const CHECKS: { key: keyof ProbeResult; label: string }[] = [
  { key: "crossOriginIsolated", label: "COOP/COEP" },
  { key: "serviceWorker",       label: "ServiceWorker" },
  { key: "opfs",                label: "OPFS" },
];

export function DeployGateProbe() {
  const [result, setResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    setResult(runDeployGateProbe());
  }, []);

  if (!result) return null;

  return (
    <div
      className="fixed bottom-8 right-4 z-50 flex flex-col gap-1 rounded-lg border border-white/10 bg-black/70 px-3 py-2 font-mono text-[10px] backdrop-blur"
      aria-label="Deploy gate probe"
    >
      <span className="mb-0.5 text-white/40 uppercase tracking-widest">Deploy Gate</span>
      {CHECKS.map(({ key, label }) => (
        <span key={key} className="flex items-center gap-2">
          <span className={result[key] ? "text-green-400" : "text-red-400"}>
            {result[key] ? "✓" : "✗"}
          </span>
          <span className={result[key] ? "text-white/70" : "text-white/35"}>{label}</span>
        </span>
      ))}
      <span className={`mt-0.5 font-bold ${result.ready ? "text-green-400" : "text-yellow-400"}`}>
        {result.ready ? "Ready" : "Not ready"}
      </span>
    </div>
  );
}

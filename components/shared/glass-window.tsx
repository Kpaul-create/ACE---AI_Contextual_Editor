"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassWindowProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  noTitleBar?: boolean;
}

export function GlassWindow({
  title,
  actions,
  children,
  className,
  contentClassName,
  noTitleBar = false,
}: GlassWindowProps) {
  return (
    <div
      className={cn(
        "glass-surface",
        "flex flex-col overflow-hidden",
        /* must fill whatever grid cell it sits in */
        "min-h-0 h-full",
        className,
      )}
    >
      {!noTitleBar && (
        <div className="glass-titlebar flex shrink-0 items-center justify-between px-2.5">
          <div className="flex items-center gap-1.5">
            {/* traffic-light dots */}
            <span className="size-2.5 rounded-full" style={{ background: "var(--tl-close)" }} />
            <span className="size-2.5 rounded-full" style={{ background: "var(--tl-minimise)" }} />
            <span className="size-2.5 rounded-full" style={{ background: "var(--tl-maximise)" }} />
            {title && (
              <span className="ml-2 select-none font-mono text-[10px] tracking-wide text-white/35">
                {title}
              </span>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-1">{actions}</div>
          )}
        </div>
      )}
      <div className={cn("min-h-0 flex-1 overflow-hidden", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

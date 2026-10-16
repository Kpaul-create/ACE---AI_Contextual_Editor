"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GlassWindow } from "@/components/shared/glass-window";
import { flags } from "@/src/flags";
import { cn } from "@/lib/utils";

interface TileProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  noTitleBar?: boolean;
  /** Bypass lazy mount for tiles that must always be live (e.g. Monaco). */
  eager?: boolean;
}

/**
 * Tile — GlassWindow with optional lazy mounting.
 *
 * When flags.lazyTiles is true:
 *   - An IntersectionObserver watches the tile's root element.
 *   - Children are not rendered until the tile enters the viewport.
 *   - Once mounted, children stay mounted (no unmount on scroll-out).
 *   - `eager` prop bypasses this for tiles that must always be live.
 *
 * When flags.lazyTiles is false:
 *   - Renders as a plain GlassWindow — identical to pre-Phase-4 behaviour.
 */
export function Tile({
  title,
  actions,
  children,
  className,
  contentClassName,
  noTitleBar = false,
  eager = false,
}: TileProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!flags.lazyTiles || eager);

  useEffect(() => {
    if (!flags.lazyTiles || eager || visible) return;

    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, visible]);

  return (
    <GlassWindow
      title={title}
      actions={actions}
      className={className}
      contentClassName={contentClassName}
      noTitleBar={noTitleBar}
    >
      {visible ? (
        children
      ) : (
        // Placeholder keeps the tile's grid cell occupied while content is lazy.
        <div
          ref={rootRef}
          className={cn("h-full w-full", contentClassName)}
          aria-hidden
        />
      )}
    </GlassWindow>
  );
}

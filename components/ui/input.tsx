import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-line bg-black/20 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent/70 focus:ring-2 focus:ring-accent/10",
        className,
      )}
      {...props}
    />
  );
}

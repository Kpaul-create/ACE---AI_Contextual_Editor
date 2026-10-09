import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  className,
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-black hover:bg-[#d5ff7b]",
        variant === "secondary" &&
          "border border-line bg-panel text-foreground hover:bg-white/[0.06]",
        variant === "ghost" && "text-muted hover:bg-white/[0.06] hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

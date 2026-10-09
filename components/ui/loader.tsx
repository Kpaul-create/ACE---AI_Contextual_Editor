export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" role="status">
      <span className="size-3 animate-spin rounded-full border border-white/20 border-t-accent" />
      {label}
    </span>
  );
}

export default function EditorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // overflow-hidden keeps the shell from scrolling; the wallpaper on <body>
  // bleeds through the 8px gaps between GlassWindow panes.
  return <div className="h-dvh overflow-hidden">{children}</div>;
}

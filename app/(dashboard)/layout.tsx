import Link from "next/link";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-dvh">
      <header className="flex h-14 items-center border-b border-line px-5">
        <Link href="/" className="text-sm font-semibold">
          <span className="mr-2 text-accent">✳</span>ACE
        </Link>
      </header>
      {children}
    </main>
  );
}

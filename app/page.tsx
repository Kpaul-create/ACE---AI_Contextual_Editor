"use client";

import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/8 px-5">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <span className="font-mono text-sm font-semibold tracking-wide text-white/80">ACE</span>
        </div>
        <nav className="flex items-center gap-1">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" className="text-xs">Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="primary" className="text-xs">Get started</Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent/80">
          <Sparkles size={11} />
          AI Contextual Editor
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white/90 sm:text-5xl">
          Edit with the context of your whole workspace.
        </h1>
        <p className="mt-5 max-w-xl font-mono text-sm leading-6 text-white/40">
          ACE retrieves the code that matters — semantic, lexical, and
          import-graph context — and completes the middle of your file with a
          fill-in-the-middle model, streamed token by token.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="primary">
                Launch editor <ArrowRight size={14} />
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="secondary">Create account</Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/workspace/default">
              <Button variant="primary">
                Open editor <ArrowRight size={14} />
              </Button>
            </Link>
          </SignedIn>
        </div>
      </main>
    </div>
  );
}
